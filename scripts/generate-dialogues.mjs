import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const GEMINI_MODELS = (
  process.env.GEMINI_MODEL ||
  'gemini-3.1-flash-lite,gemini-3.1-flash-lite-preview,gemini-flash-lite-latest,gemini-3.6-flash'
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 45000);

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    context: { type: Type.STRING },
    turns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING, enum: ['Partner', 'You'] },
          text_de: { type: Type.STRING },
          text_fr: { type: Type.STRING },
          is_user_turn: { type: Type.BOOLEAN },
          blank_target: { type: Type.STRING, nullable: true },
          distractors: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['speaker', 'text_de', 'text_fr', 'is_user_turn', 'blank_target', 'distractors'],
      },
    },
  },
  required: ['title', 'context', 'turns'],
};

function getSupabaseClient() {
  const rawSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseUrl = rawSupabaseUrl
    ? rawSupabaseUrl.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '')
    : '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL / VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchAllLearningItems(supabase) {
  const all = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('learning_items')
      .select('id, theme_id, german, translation, article, item_type')
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to fetch learning_items: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function sanitizeDialogue(raw, theme) {
  const title = String(raw?.title || `${theme.title} — Mini-Dialogue`).trim();
  const context = String(
    raw?.context || `A short everyday A1 conversation practicing "${theme.title}".`
  ).trim();

  const rawTurns = Array.isArray(raw?.turns) ? raw.turns.slice(0, 5) : [];

  const turns = rawTurns.map((t, idx) => {
    const textDe = String(t.text_de || '').trim();
    const textFr = String(t.text_fr || '').trim();
    const isUser = Boolean(t.is_user_turn);
    const speaker = isUser ? 'You' : t.speaker === 'You' ? 'You' : 'Partner';

    if (!isUser) {
      return {
        speaker,
        text_de: textDe,
        text_fr: textFr,
        is_user_turn: false,
        blank_target: null,
        distractors: [],
      };
    }

    let blankTarget = String(t.blank_target || '').trim();
    if (blankTarget && !textDe.includes(blankTarget)) {
      const ciIdx = textDe.toLowerCase().indexOf(blankTarget.toLowerCase());
      if (ciIdx !== -1) {
        blankTarget = textDe.slice(ciIdx, ciIdx + blankTarget.length);
      } else {
        blankTarget = '';
      }
    }
    if (!blankTarget) {
      const words = textDe.replace(/[.,!?;:„“"()]/g, '').split(/\s+/).filter((w) => w.length >= 2);
      blankTarget = words[Math.min(words.length - 1, Math.max(0, words.length - 2))] || words[0] || textDe;
    }

    const distractors = [];
    for (const d of Array.isArray(t.distractors) ? t.distractors : []) {
      const val = String(d || '').trim();
      if (val && val.toLowerCase() !== blankTarget.toLowerCase() && !distractors.includes(val)) {
        distractors.push(val);
      }
      if (distractors.length === 3) break;
    }
    const fallbacks = ['bitte', 'heute', 'immer', 'sehr', 'auch'];
    for (const fb of fallbacks) {
      if (distractors.length >= 3) break;
      if (fb.toLowerCase() !== blankTarget.toLowerCase() && !distractors.includes(fb)) {
        distractors.push(fb);
      }
    }

    return {
      speaker: idx % 2 === 1 ? 'You' : speaker,
      text_de: textDe,
      text_fr: textFr,
      is_user_turn: true,
      blank_target: blankTarget,
      distractors,
    };
  });

  // Guarantee at least 2 user turns with blanks
  let userTurnCount = turns.filter((t) => t.is_user_turn).length;
  for (let i = 0; i < turns.length && userTurnCount < 2; i++) {
    if (!turns[i].is_user_turn && turns[i].text_de) {
      const words = turns[i].text_de
        .replace(/[.,!?;:„“"()]/g, '')
        .split(/\s+/)
        .filter((w) => w.length >= 2);
      const target = words[words.length - 1] || turns[i].text_de;
      turns[i] = {
        ...turns[i],
        speaker: 'You',
        is_user_turn: true,
        blank_target: target,
        distractors: ['bitte', 'heute', 'gern'].filter((d) => d.toLowerCase() !== target.toLowerCase()).slice(0, 3),
      };
      userTurnCount++;
    }
  }

  return { title, context, turns };
}

async function generateDialogueWithGemini(ai, theme, themeItems) {
  // Sample up to 40 representative vocabulary items from the theme
  const sampleVocab = themeItems.slice(0, 40).map((it) => {
    const word = it.article ? `${it.article} ${it.german}` : it.german;
    return `${word} (${it.translation})`;
  });

  const prompt = `You are a CEFR A1 German curriculum designer.
Generate ONE realistic, natural CEFR A1 mini-dialogue for Theme #${theme.order_index}: "${theme.title}".
Theme description: ${theme.description}
Grammar focus: ${theme.grammar_focus}

Vocabulary from this theme to naturally reuse:
${sampleVocab.join(', ')}

Strict rules:
1. Language rule (100% ENGLISH + GERMAN ONLY, zero French):
   - "title": short, clear ENGLISH title (3 to 6 words, e.g. "Ordering Coffee at the Café").
   - "context": 1 concise ENGLISH sentence describing the real-life situation.
   - "text_de": natural CEFR A1 German line (4 to 10 words).
   - "text_fr": natural ENGLISH translation of text_de (note: keep the JSON property name "text_fr", write its value in ENGLISH).
2. Structure:
   - Exactly 4 or 5 turns alternating between "Partner" and "You".
   - At least 2 turns MUST have "is_user_turn": true (with speaker: "You").
   - For every turn where "is_user_turn": true:
     * "blank_target" MUST be a key German word or short phrase (1 to 3 words) from the theme that appears VERBATIM (exact spelling & case) inside "text_de".
     * "distractors" MUST contain exactly 3 plausible, distinct German alternatives of the same grammatical category (distinct from blank_target).
   - For turns where "is_user_turn": false:
     * "blank_target": null
     * "distractors": []`;

  for (let attempt = 1; attempt <= 6; attempt++) {
    const modelName = GEMINI_MODELS[(attempt - 1) % GEMINI_MODELS.length];
    try {
      const response = await Promise.race([
        ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            thinkingConfig: { thinkingLevel: 'minimal' },
            maxOutputTokens: 4096,
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS)
        ),
      ]);

      const parsed = JSON.parse(response.text);
      const dialogue = sanitizeDialogue(parsed, theme);
      if (dialogue.turns.length < 4) {
        throw new Error(`Expected 4-5 turns, got ${dialogue.turns.length}`);
      }
      return dialogue;
    } catch (err) {
      console.warn(
        `⚠️ Gemini attempt ${attempt}/6 (${modelName}) for Theme #${theme.order_index} failed: ${String(err.message).slice(0, 140)}`
      );
      if (attempt === 6) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error(`Unable to generate dialogue for Theme #${theme.order_index}`);
}

async function upsertDialogue(supabase, themeId, dialogue) {
  const payload = {
    theme_id: themeId,
    title: dialogue.title,
    context: dialogue.context,
    turns: dialogue.turns,
  };

  const { error } = await supabase
    .from('theme_dialogues')
    .upsert(payload, { onConflict: 'theme_id' });

  if (!error) return;

  // Fallback if unique constraint on theme_id was not created yet
  if (/no unique or exclusion constraint/i.test(error.message)) {
    const { data: existing } = await supabase
      .from('theme_dialogues')
      .select('id')
      .eq('theme_id', themeId)
      .maybeSingle();

    if (existing?.id) {
      const { error: updErr } = await supabase
        .from('theme_dialogues')
        .update(payload)
        .eq('id', existing.id);
      if (updErr) throw new Error(`Update dialogue failed for theme ${themeId}: ${updErr.message}`);
    } else {
      const { error: insErr } = await supabase.from('theme_dialogues').insert(payload);
      if (insErr) throw new Error(`Insert dialogue failed for theme ${themeId}: ${insErr.message}`);
    }
    return;
  }

  throw new Error(`Upsert dialogue failed for theme ${themeId}: ${error.message}`);
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY in .env');
  }

  const force = process.argv.includes('--force');
  const supabase = getSupabaseClient();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const [{ data: themes, error: themesErr }, { data: existingDialogues, error: existingErr }, allItems] =
    await Promise.all([
      supabase.from('themes').select('*').order('order_index', { ascending: true }),
      supabase.from('theme_dialogues').select('theme_id, title'),
      fetchAllLearningItems(supabase),
    ]);

  if (themesErr) throw new Error(`Failed to fetch themes: ${themesErr.message}`);
  if (existingErr) throw new Error(`Failed to fetch theme_dialogues: ${existingErr.message}`);

  const existingByThemeId = new Set((existingDialogues || []).map((d) => d.theme_id));
  console.log(
    `📚 Loaded ${themes.length} themes, ${allItems.length} items, ${existingByThemeId.size} existing dialogues.\n`
  );

  for (const theme of themes) {
    if (!force && existingByThemeId.has(theme.id)) {
      console.log(`⏭️  Theme #${theme.order_index} "${theme.title}" already has a dialogue.`);
      continue;
    }

    const themeItems = allItems.filter((it) => it.theme_id === theme.id);
    console.log(
      `🤖 Generating A1 dialogue for Theme #${theme.order_index} "${theme.title}" (${themeItems.length} items)...`
    );
    const dialogue = await generateDialogueWithGemini(ai, theme, themeItems);
    await upsertDialogue(supabase, theme.id, dialogue);
    const userTurns = dialogue.turns.filter((t) => t.is_user_turn).length;
    console.log(
      `   ✅ Saved "${dialogue.title}" (${dialogue.turns.length} turns, ${userTurns} interactive blanks)`
    );
  }

  // Final verification directly from Supabase
  const { data: finalDialogues, error: verifyErr } = await supabase
    .from('theme_dialogues')
    .select('theme_id, title, context, turns');

  if (verifyErr) throw new Error(`Verification query failed: ${verifyErr.message}`);

  const dialogueByThemeId = new Map((finalDialogues || []).map((d) => [d.theme_id, d]));

  console.log('\n=============================================================================');
  console.log(
    `🎉 VERIFICATION: ${dialogueByThemeId.size} / ${themes.length} themes have a dialogue in Supabase`
  );
  console.log('=============================================================================\n');

  let missing = 0;
  for (const theme of themes) {
    const d = dialogueByThemeId.get(theme.id);
    if (!d) {
      missing++;
      console.log(`❌ Theme ${String(theme.order_index).padStart(2, '0')} — ${theme.title}: MISSING`);
      continue;
    }
    const turns = Array.isArray(d.turns) ? d.turns : [];
    const interactive = turns.filter((t) => t.is_user_turn).length;
    const blanks = turns
      .filter((t) => t.is_user_turn)
      .map((t) => t.blank_target)
      .join(', ');
    console.log(
      `💬 Theme ${String(theme.order_index).padStart(2, '0')} — ${theme.title}\n   Title: "${d.title}" (${turns.length} turns, ${interactive} user blanks: [${blanks}])`
    );
  }

  if (missing > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('❌ generate-dialogues error:', err.message);
  process.exit(1);
});
