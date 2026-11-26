import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 120000);

const GRAMMAR_THEME_TITLE = 'Pronouns, Grammar Basics & Function Words';
const GRAMMAR_THEME_DESC =
  'Master personal and possessive pronouns, essential prepositions, conjunctions, and auxiliary verb forms (sein, haben, werden).';
const GRAMMAR_THEME_FOCUS =
  'Nominative/accusative/dative pronouns (ich, mich, mir, dich, ihm, uns, euch), possessive determiners (mein, dein, sein, ihr), core prepositions (mit, für, zu, von, bei, nach), coordinating conjunctions (und, aber, oder, denn), and auxiliary verbs sein/haben.';

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    updates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          item_type: { type: Type.STRING },
          sentence_de: { type: Type.STRING },
          sentence_translation: { type: Type.STRING },
          cloze_target: { type: Type.STRING },
          distractors: { type: Type.ARRAY, items: { type: Type.STRING } },
          grammar_tip: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: [
          'id',
          'item_type',
          'sentence_de',
          'sentence_translation',
          'cloze_target',
          'distractors',
          'grammar_tip',
          'reason',
        ],
      },
    },
  },
  required: ['updates'],
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
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to fetch learning_items: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

/**
 * Ensures a dedicated Grammar Basics theme exists at order_index = 3 (within first 3 chapters).
 * Shifts subsequent themes cleanly from highest order_index down to avoid unique constraint collisions.
 */
async function ensureGrammarBasicsTheme(supabase) {
  const { data: themes, error } = await supabase
    .from('themes')
    .select('*')
    .order('order_index', { ascending: true });

  if (error) throw new Error(`Failed to fetch themes: ${error.message}`);

  // Check if a grammar basics theme already exists in the first 3 chapters
  const existingEarly = themes.find(
    (t) =>
      t.order_index <= 3 &&
      /pronoun|grammar|function word|mots-outils/i.test(`${t.title} ${t.description}`)
  );

  if (existingEarly) {
    console.log(
      `✅ Existing Grammar Basics theme found at position ${existingEarly.order_index}: "${existingEarly.title}" (id=${existingEarly.id})`
    );
    return { grammarTheme: existingEarly, themes };
  }

  // Check if it exists elsewhere
  const existingAnywhere = themes.find((t) =>
    /pronouns, grammar basics|function words/i.test(t.title)
  );

  const targetOrderIndex = 3;
  console.log(
    `🔧 Creating "${GRAMMAR_THEME_TITLE}" at order_index=${targetOrderIndex} and shifting themes >= ${targetOrderIndex}...`
  );

  if (existingAnywhere) {
    return { grammarTheme: existingAnywhere, themes };
  }

  // Shift themes with order_index >= 3 in descending order so unique(order_index) never collides
  const toShift = themes
    .filter((t) => t.order_index >= targetOrderIndex)
    .sort((a, b) => b.order_index - a.order_index);

  for (const t of toShift) {
    const { error: shiftErr } = await supabase
      .from('themes')
      .update({ order_index: t.order_index + 1 })
      .eq('id', t.id);
    if (shiftErr) {
      throw new Error(`Failed shifting theme id=${t.id} to ${t.order_index + 1}: ${shiftErr.message}`);
    }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('themes')
    .insert({
      order_index: targetOrderIndex,
      title: GRAMMAR_THEME_TITLE,
      description: GRAMMAR_THEME_DESC,
      grammar_focus: GRAMMAR_THEME_FOCUS,
    })
    .select('*')
    .single();

  if (insertErr) {
    throw new Error(`Failed inserting grammar basics theme: ${insertErr.message}`);
  }

  const { data: refreshedThemes } = await supabase
    .from('themes')
    .select('*')
    .order('order_index', { ascending: true });

  console.log(
    `✅ Created theme "${inserted.title}" (id=${inserted.id}, order_index=${inserted.order_index})`
  );
  return { grammarTheme: inserted, themes: refreshedThemes || themes };
}

/**
 * Broad pre-filter to select all possible pronouns, prepositions, conjunctions,
 * grammar items, and auxiliary/modal verbs or function words that might be misplaced
 * in concrete themes (order_index > 3).
 */
function prefilterCandidates(items, themeById, grammarThemeId) {
  const functionWordRegex =
    /^(ich|du|er|sie|es|wir|ihr|Sie|mich|dich|ihn|uns|euch|mir|dir|ihm|ihnen|Ihnen|mein|meine|meinen|meinem|dein|deine|deinen|deinem|sein|seine|seinen|seinem|unser|unsere|euer|eure|dieser|diese|dieses|jeder|jede|jedes|welcher|welche|welches|man|jemand|niemand|etwas|nichts|alles|alle|selbst|einander|mit|ohne|für|gegen|durch|um|aus|bei|nach|seit|von|zu|außer|an|auf|hinter|in|neben|über|unter|vor|zwischen|ab|bis|trotz|während|wegen|statt|und|oder|aber|denn|sondern|weil|dass|wenn|als|ob|obwohl|damit|haben|hat|hast|habt|hatte|hatten|bin|bist|ist|sind|seid|war|waren|werden|wird|werde|wurde|nicht|kein|keine|keinen|keinem)$/i;

  const auxiliaryPhraseRegex =
    /\b(bin|bist|ist|sind|seid|war|waren|habe|hast|hat|haben|habt|hatte|hatten|werde|wirst|wird|werden|werdet)\b/i;

  return items.filter((item) => {
    if (item.theme_id === grammarThemeId) return false;
    const theme = themeById.get(item.theme_id);
    // Keep Chapter 1 & 2 greeting/origin items intact unless they are pure misplaced grammar in concrete themes
    if (!theme) return false;

    const cleanGerman = item.german
      .replace(/\(.*?\)/g, '')
      .trim();

    const isGrammaticalType = ['pronoun', 'preposition', 'conjunction', 'grammar'].includes(
      item.item_type
    );
    const matchesFunctionWord = functionWordRegex.test(cleanGerman);
    const matchesAuxPhrase =
      item.item_type !== 'noun' &&
      item.item_type !== 'phrase' &&
      auxiliaryPhraseRegex.test(cleanGerman);

    // Only consider items currently placed outside chapters 1-3 (concrete themes like Family, Food, Shopping, Transport, etc.)
    // OR items in chapters 1-3 that are pure accusative/dative pronouns, prepositions, conjunctions, or auxiliary paradigm cards
    const isInConcreteTheme = theme.order_index > 3;

    if (isInConcreteTheme && (isGrammaticalType || matchesFunctionWord || matchesAuxPhrase)) {
      return true;
    }

    return false;
  });
}

async function analyzeBatchWithGemini(ai, batch, themeById) {
  const payload = batch.map((it) => ({
    id: it.id,
    german: it.german,
    translation: it.translation,
    item_type: it.item_type,
    current_theme: themeById.get(it.theme_id)?.title || 'Unknown',
    current_sentence_de: it.sentence_de,
  }));

  const prompt = `You are a CEFR A1 German curriculum architect.
We have a dedicated early chapter: "${GRAMMAR_THEME_TITLE}" (for personal/possessive/demonstrative/indefinite pronouns, prepositions, conjunctions, negation words like nicht/kein/keinen, and auxiliary verbs sein/haben/werden or their conjugated forms).

Review the following candidate items that are currently placed in concrete thematic chapters (such as Shopping, Groceries, Food, Clothing, Transport, Home, Family, Hobbies, etc.).

Select ONLY the items that are:
- Personal, reflexive, possessive, demonstrative, relative, or indefinite pronouns (e.g., dich, mich, mir, dir, ihm, ihn, uns, euch, mein, dein, sein, ihr, man, jemand, niemand, dieser, etc.)
- Prepositions (e.g., mit, für, durch, ohne, gegen, um, aus, bei, nach, seit, von, zu, an, auf, in, über, unter, vor, hinter, neben, zwischen, ab, bis, etc.)
- Conjunctions (e.g., und, aber, oder, denn, weil, dass, wenn, als, ob, sondern, etc.)
- Auxiliary verbs (sein, haben, werden, or their conjugated forms like "sie/Sie haben", "ihr habt", "er/sie/es hat", "war", "hatte") or pure grammatical negation/determiner building blocks (nicht, kein, keine, keinen, ein, eine, einen) that were placed inside concrete themes.

DO NOT select concrete thematic nouns, concrete action verbs (like "er fährt", "sie liest", "kaufen", "essen"), or time/number expressions that genuinely belong in their concrete theme (like "um ... Uhr" in Time, or "wie viel" in Numbers/Prices).

For each selected item, return:
- id: exact item id
- item_type: accurate type among "pronoun" | "preposition" | "conjunction" | "grammar" | "verb"
- sentence_de: a simple, universal CEFR A1 German example sentence (5 to 8 words) that clearly illustrates the word and contains cloze_target verbatim
- sentence_translation: natural English translation of sentence_de (100% English, zero French)
- cloze_target: exact word/form in sentence_de to blank out
- distractors: 3 plausible German distractors of the same grammatical category, distinct from cloze_target
- grammar_tip: 1 concise, helpful English grammar tip for A1 learners (zero French)
- reason: short English explanation of why it was moved from its current concrete theme

Candidates JSON:
${JSON.stringify(payload)}`;

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await Promise.race([
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            thinkingConfig: { thinkingLevel: 'minimal' },
            maxOutputTokens: 32768,
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS)
        ),
      ]);

      const parsed = JSON.parse(response.text);
      return Array.isArray(parsed?.updates) ? parsed.updates : [];
    } catch (err) {
      console.warn(`⚠️ Gemini attempt ${attempt}/4 failed: ${err.message}`);
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  return [];
}

function sanitizeUpdate(u, original) {
  let sentenceDe = String(u.sentence_de || original.sentence_de).trim();
  let clozeTarget = String(u.cloze_target || original.cloze_target).trim();

  if (clozeTarget && !sentenceDe.includes(clozeTarget)) {
    const ci = sentenceDe.toLowerCase().indexOf(clozeTarget.toLowerCase());
    if (ci !== -1) {
      clozeTarget = sentenceDe.slice(ci, ci + clozeTarget.length);
    }
  }
  if (!clozeTarget || !sentenceDe.includes(clozeTarget)) {
    const cleanWord = original.german.replace(/\(.*?\)/g, '').trim();
    const ci = sentenceDe.toLowerCase().indexOf(cleanWord.toLowerCase());
    if (ci !== -1) {
      clozeTarget = sentenceDe.slice(ci, ci + cleanWord.length);
    } else {
      const tokens = sentenceDe.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
      clozeTarget = tokens[0] || original.cloze_target;
    }
  }

  const distractors = [];
  for (const d of Array.isArray(u.distractors) ? u.distractors : []) {
    const val = String(d || '').trim();
    if (val && val.toLowerCase() !== clozeTarget.toLowerCase() && !distractors.includes(val)) {
      distractors.push(val);
    }
    if (distractors.length === 3) break;
  }
  while (distractors.length < 3) {
    distractors.push(original.distractors?.[distractors.length] || `Option ${distractors.length + 1}`);
  }

  return {
    item_type: String(u.item_type || original.item_type).trim(),
    sentence_de: sentenceDe,
    sentence_translation: String(u.sentence_translation || original.sentence_translation).trim(),
    cloze_target: clozeTarget,
    distractors,
    grammar_tip: String(u.grammar_tip || original.grammar_tip).trim(),
  };
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY in .env');
  }

  const supabase = getSupabaseClient();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Step 1: Ensure dedicated Grammar Basics theme in first 3 chapters
  const { grammarTheme, themes } = await ensureGrammarBasicsTheme(supabase);
  const themeById = new Map(themes.map((t) => [t.id, t]));

  // Step 2: Fetch all learning_items & pre-filter candidates in concrete themes
  const allItems = await fetchAllLearningItems(supabase);
  console.log(`📚 Loaded ${allItems.length} total items from Supabase Cloud.`);

  const candidates = prefilterCandidates(allItems, themeById, grammarTheme.id);
  console.log(
    `🔍 Found ${candidates.length} candidate grammar/function-word items in concrete chapters (order_index > 3). Asking Gemini to classify and craft universal A1 sentences...`
  );

  const itemById = new Map(allItems.map((it) => [it.id, it]));
  const BATCH_SIZE = 45;
  const approvedUpdates = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    console.log(
      `🤖 Gemini analysis batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(candidates.length / BATCH_SIZE)} (${batch.length} candidates)...`
    );
    const updates = await analyzeBatchWithGemini(ai, batch, themeById);
    for (const u of updates) {
      if (itemById.has(u.id)) {
        approvedUpdates.push(u);
      }
    }
  }

  console.log(`✨ Gemini identified ${approvedUpdates.length} misplaced grammar items to move.`);

  // Step 3: Update each item in-place by its existing id (preserving user_progress foreign keys)
  const movedReport = [];
  for (const u of approvedUpdates) {
    const original = itemById.get(u.id);
    const oldTheme = themeById.get(original.theme_id);
    const cleanFields = sanitizeUpdate(u, original);

    const { error: updateErr } = await supabase
      .from('learning_items')
      .update({
        theme_id: grammarTheme.id,
        ...cleanFields,
      })
      .eq('id', original.id);

    if (updateErr) {
      // If updating item_type would collide with (german, item_type) unique constraint, keep original item_type
      const { error: retryErr } = await supabase
        .from('learning_items')
        .update({
          theme_id: grammarTheme.id,
          sentence_de: cleanFields.sentence_de,
          sentence_translation: cleanFields.sentence_translation,
          cloze_target: cleanFields.cloze_target,
          distractors: cleanFields.distractors,
          grammar_tip: cleanFields.grammar_tip,
        })
        .eq('id', original.id);

      if (retryErr) {
        console.error(`❌ Failed to update "${original.german}" (id=${original.id}): ${retryErr.message}`);
        continue;
      }
    }

    movedReport.push({
      id: original.id,
      german: original.german,
      translation: original.translation,
      type: cleanFields.item_type,
      fromTheme: oldTheme ? `${oldTheme.order_index}. ${oldTheme.title}` : String(original.theme_id),
      toTheme: `${grammarTheme.order_index}. ${grammarTheme.title}`,
      sentence_de: cleanFields.sentence_de,
      sentence_translation: cleanFields.sentence_translation,
    });
  }

  // Step 4: Display summary report
  console.log(
    `\n✅ Successfully moved ${movedReport.length} grammar/function words into Theme #${grammarTheme.order_index} "${grammarTheme.title}":\n`
  );
  for (const m of movedReport) {
    console.log(
      ` • ${m.german} (${m.translation}) [${m.type}] : ${m.fromTheme}  -->  ${m.toTheme}\n   ↳ "${m.sentence_de}" (${m.sentence_translation})`
    );
  }
}

main().catch((err) => {
  console.error('❌ fix-grammar-themes error:', err.message);
  process.exit(1);
});
