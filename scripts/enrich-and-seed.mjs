import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const CORPUS_PATH = path.join(ROOT_DIR, 'data', 'raw', 'a1_clean_corpus.json');
const CHECKPOINT_PATH = path.join(ROOT_DIR, 'data', 'enriched_backup.json');

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 75);
const BATCH_DELAY_MS = Number(process.env.BATCH_DELAY_MS || 1500);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 120000);
const SYNC_EVERY_N_BATCHES = 3;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

// 18 progressive CEFR A1 themes (100% English & German — no French)
export const A1_THEMES = [
  {
    order_index: 1,
    title: 'Greetings & First Contacts',
    description: 'Say hello, goodbye, thank you, excuse me, and introduce yourself politely.',
    grammar_focus: 'Personal pronouns (ich, du, Sie), present tense of heißen and sein, and the V2 verb-second rule.',
  },
  {
    order_index: 2,
    title: 'Introducing Yourself: Countries, Languages & Origins',
    description: 'Talk about your country, nationality, city, and the languages you speak.',
    grammar_focus: 'W-questions (Woher? Wo? Was?), verbs kommen, wohnen, sprechen (e → i), prepositions aus and in.',
  },
  {
    order_index: 3,
    title: 'Numbers, Prices & Contact Details',
    description: 'Count, give your age, phone number, address, and ask how much something costs.',
    grammar_focus: 'Cardinal numbers (0 to 1000), ones + und + tens inversion, and the question Wie viel?.',
  },
  {
    order_index: 4,
    title: 'Family & Close Friends',
    description: 'Introduce your family members, friends, and talk about personal relationships.',
    grammar_focus: 'Present tense of haben, possessive articles (mein/dein/sein/ihr), and common noun plurals.',
  },
  {
    order_index: 5,
    title: 'Everyday Objects & Colors',
    description: 'Name everyday items, describe them, and master the three German grammatical genders.',
    grammar_focus: 'Definite articles (der/die/das), indefinite articles (ein/eine), and noun negation with kein/keine.',
  },
  {
    order_index: 6,
    title: 'Time, Days & Daily Routine',
    description: 'Tell the time, talk about parts of the day, and describe your daily schedule.',
    grammar_focus: 'Time prepositions (am + day, um + clock time) and separable verbs (aufstehen, anfangen).',
  },
  {
    order_index: 7,
    title: 'Food & Drinks',
    description: 'Talk about meals, breakfast, ingredients, and what you like to eat and drink.',
    grammar_focus: 'Accusative case (der → den, ein → einen, kein → keinen), verbs essen (e → i) and trinken, polite möchten.',
  },
  {
    order_index: 8,
    title: 'Groceries, Supermarket & Eating Out',
    description: 'Order at a café or restaurant, shop at the market, and ask for the bill.',
    grammar_focus: 'Accusative with kaufen/brauchen/nehmen, quantities, polite requests with Ich hätte gern / Ich möchte.',
  },
  {
    order_index: 9,
    title: 'Home & Living',
    description: 'Describe rooms, furniture, your apartment, and your neighborhood.',
    grammar_focus: 'Predicate adjectives (Die Wohnung ist hell), negation with nicht vs. kein, and basic location phrases.',
  },
  {
    order_index: 10,
    title: 'City, Places & Directions',
    description: 'Ask for and give directions, and identify key buildings and shops in town.',
    grammar_focus: 'Wo? vs. Wohin?, polite imperative (Gehen Sie geradeaus!), and essential place prepositions.',
  },
  {
    order_index: 11,
    title: 'Transport & Travel',
    description: 'Take the train, bus, or plane, buy a ticket, and book a hotel room.',
    grammar_focus: 'Stem-changing verb fahren (a → ä), mit + transport (mit dem Zug), separable verbs (abfahren, umsteigen).',
  },
  {
    order_index: 12,
    title: 'Work, Studies & Professions',
    description: 'Talk about your job, workplace, university studies, and office life.',
    grammar_focus: 'Feminine job titles (-in), als + profession without an article (Ich arbeite als Lehrer), verb arbeiten.',
  },
  {
    order_index: 13,
    title: 'Hobbies, Sports & Culture',
    description: 'Talk about free-time activities, sports, music, and suggest going out.',
    grammar_focus: 'Adverbs gern / lieber, common stem-changing verbs (lesen e → ie, sehen e → ie, laufen a → ä), modal verb können.',
  },
  {
    order_index: 14,
    title: 'Body & Health',
    description: 'Name body parts, describe symptoms, and visit a doctor or pharmacy.',
    grammar_focus: 'Expression wehtun (Mein Kopf tut weh), modal verbs müssen and dürfen (obligation and permission).',
  },
  {
    order_index: 15,
    title: 'Clothing & Shopping',
    description: 'Shop for clothes, talk about sizes and fabrics, and express opinions.',
    grammar_focus: 'Accusative personal pronouns (mich, dich, ihn, sie, es) and basic demonstratives (dieser/diese/dieses).',
  },
  {
    order_index: 16,
    title: 'Weather, Seasons & Nature',
    description: 'Talk about the weather, seasons, months, and outdoor landscapes.',
    grammar_focus: 'Impersonal constructions with es (Es regnet, Es ist kalt) and im + month/season.',
  },
  {
    order_index: 17,
    title: 'Appointments, Celebrations & Communication',
    description: 'Schedule appointments, write simple messages, wish happy birthday, and make phone calls.',
    grammar_focus: 'Ordinal dates (am ersten Mai), modal verbs wollen and sollen, coordinating conjunctions (und, aber, oder, denn).',
  },
  {
    order_index: 18,
    title: 'Talking About the Past & A1 Review',
    description: 'Describe your day or vacation in the past and consolidate core CEFR A1 structures.',
    grammar_focus: 'Introduction to Perfekt (haben/sein + past participle ge-...-t/-en) and simple past of sein (war) and haben (hatte).',
  },
];

// Compact JSON keys to reduce output tokens (~2x smaller) without affecting pedagogical quality
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          i: { type: Type.INTEGER }, // source_index
          t: { type: Type.INTEGER }, // theme_order (1-18)
          k: { type: Type.STRING }, // item_type
          g: { type: Type.STRING }, // german
          tr: { type: Type.STRING }, // translation (EN)
          a: { type: Type.STRING, nullable: true }, // article (der|die|das|null)
          p: { type: Type.STRING, nullable: true }, // plural
          s: { type: Type.STRING }, // sentence_de
          st: { type: Type.STRING }, // sentence_translation (EN)
          c: { type: Type.STRING }, // cloze_target
          d: { type: Type.ARRAY, items: { type: Type.STRING } }, // distractors (3)
          tip: { type: Type.STRING }, // grammar_tip (EN)
        },
        required: ['i', 't', 'k', 'g', 'tr', 's', 'st', 'c', 'd', 'tip'],
      },
    },
  },
  required: ['items'],
};

function parseCliArgs() {
  const args = process.argv.slice(2);
  let limit = Infinity;
  let seedOnly = false;
  let skipSeed = false;

  for (const arg of args) {
    if (arg === '--seed-only') seedOnly = true;
    else if (arg === '--skip-seed') skipSeed = true;
    else if (arg.startsWith('--limit=')) {
      const val = Number.parseInt(arg.split('=')[1], 10);
      if (Number.isFinite(val) && val > 0) limit = val;
    }
  }
  return { limit, seedOnly, skipSeed };
}

async function loadCheckpoint() {
  try {
    const raw = await fs.readFile(CHECKPOINT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.items)) return parsed;
  } catch {
    // No existing checkpoint
  }
  return { model: GEMINI_MODEL, updated_at: null, items: [] };
}

async function saveCheckpoint(checkpoint) {
  checkpoint.updated_at = new Date().toISOString();
  await fs.mkdir(path.dirname(CHECKPOINT_PATH), { recursive: true });
  await fs.writeFile(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2), 'utf8');
}

function buildPrompt(batch) {
  const themesSummary = A1_THEMES.map((t) => `${t.order_index}:${t.title}`).join('; ');

  const compactInput = batch.map((entry) => ({
    index: entry.index,
    german: entry.german,
    translation: entry.translation,
    item_type: entry.item_type,
    article: entry.article,
    plural: entry.plural,
  }));

  return `Enrich these ${batch.length} CEFR A1 German items into JSON (100% ENGLISH + GERMAN ONLY, zero French).
Themes (t = 1..18): ${themesSummary}.
Key map: i=exact input index, t=theme_order(1-18), k=item_type(noun|verb|adjective|adverb|pronoun|preposition|conjunction|phrase|number|grammar|other), g=clean German word (capitalize nouns without article), tr=concise English translation, a="der"|"die"|"das" for singular nouns else null, p=German plural for nouns else null, s=short natural A1 German sentence (5-9 words) containing c verbatim, st=natural English translation of s, c=exact word/phrase in s to blank out, d=array of 3 plausible German distractors of same grammatical type distinct from c, tip=1 short helpful English grammar tip.
Items: ${JSON.stringify(compactInput)}`;
}

function sanitizeEnrichedItem(item, fallbackSource) {
  const validArticles = new Set(['der', 'die', 'das']);
  const themeOrder = Math.min(18, Math.max(1, Number(item.theme_order) || 1));
  const german = String(item.german || fallbackSource.german).trim();
  const itemType = String(item.item_type || fallbackSource.item_type || 'other').trim();
  const article =
    itemType === 'noun' && validArticles.has(String(item.article || '').toLowerCase())
      ? String(item.article).toLowerCase()
      : null;

  let sentenceDe = String(item.sentence_de || '').trim();
  let clozeTarget = String(item.cloze_target || '').trim();

  // Ensure cloze_target appears verbatim in sentence_de (matching exact case)
  if (!sentenceDe) {
    sentenceDe = fallbackSource.example_de || `${german}.`;
  }
  if (clozeTarget && !sentenceDe.includes(clozeTarget)) {
    const ciIdx = sentenceDe.toLowerCase().indexOf(clozeTarget.toLowerCase());
    if (ciIdx !== -1) {
      clozeTarget = sentenceDe.slice(ciIdx, ciIdx + clozeTarget.length);
    }
  }
  if (!clozeTarget || !sentenceDe.includes(clozeTarget)) {
    const ciGermanIdx = sentenceDe.toLowerCase().indexOf(german.toLowerCase());
    if (ciGermanIdx !== -1) {
      clozeTarget = sentenceDe.slice(ciGermanIdx, ciGermanIdx + german.length);
    } else {
      const tokens = sentenceDe.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
      clozeTarget = tokens[tokens.length - 1] || german;
    }
  }

  // Guarantee 3 distinct distractors
  const rawDistractors = Array.isArray(item.distractors) ? item.distractors : [];
  const distractors = [];
  for (const d of rawDistractors) {
    const val = String(d || '').trim();
    if (val && val.toLowerCase() !== clozeTarget.toLowerCase() && !distractors.includes(val)) {
      distractors.push(val);
    }
    if (distractors.length === 3) break;
  }
  while (distractors.length < 3) {
    distractors.push(`Option ${distractors.length + 1}`);
  }

  return {
    source_index: Number(item.source_index ?? fallbackSource.index),
    theme_order: themeOrder,
    item_type: itemType,
    german,
    translation: String(item.translation || fallbackSource.translation).trim(),
    article,
    plural: itemType === 'noun' && item.plural ? String(item.plural).trim() : null,
    sentence_de: sentenceDe,
    sentence_translation: String(item.sentence_translation || '').trim() || item.translation,
    cloze_target: clozeTarget,
    distractors,
    grammar_tip:
      String(item.grammar_tip || '').trim() ||
      'A1 tip: in German main clauses, the conjugated verb always sits in second position (V2).',
  };
}

async function enrichBatchWithRetry(ai, batch, maxRetries = 6) {
  const prompt = buildPrompt(batch);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
          setTimeout(() => reject(new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS)
        ),
      ]);

      const parsed = JSON.parse(response.text);
      if (!parsed || !Array.isArray(parsed.items)) {
        throw new Error('Gemini JSON response missing `items` array.');
      }

      const byIndex = new Map(batch.map((b) => [b.index, b]));
      return parsed.items
        .map((raw) => ({
          source_index: raw.i ?? raw.source_index,
          theme_order: raw.t ?? raw.theme_order,
          item_type: raw.k ?? raw.item_type,
          german: raw.g ?? raw.german,
          translation: raw.tr ?? raw.translation,
          article: raw.a !== undefined ? raw.a : raw.article,
          plural: raw.p !== undefined ? raw.p : raw.plural,
          sentence_de: raw.s ?? raw.sentence_de,
          sentence_translation: raw.st ?? raw.sentence_translation,
          cloze_target: raw.c ?? raw.cloze_target,
          distractors: raw.d ?? raw.distractors,
          grammar_tip: raw.tip ?? raw.grammar_tip,
        }))
        .filter((it) => byIndex.has(Number(it.source_index)))
        .map((it) => sanitizeEnrichedItem(it, byIndex.get(Number(it.source_index))));
    } catch (err) {
      const msg = String(err?.message || err);
      const isRateLimit = /429|RESOURCE_EXHAUSTED|rate|quota/i.test(msg);
      const isDailyQuota = /per day|PerDay|daily/i.test(msg);
      if (isDailyQuota) {
        const dailyErr = new Error(`Gemini daily quota reached: ${msg}`);
        dailyErr.isDailyQuota = true;
        throw dailyErr;
      }
      const delayMs = isRateLimit
        ? Math.min(65000, 15000 * attempt)
        : 2500 * Math.pow(2, attempt - 1);
      console.warn(
        `⚠️  Attempt ${attempt}/${maxRetries} failed (${msg.slice(0, 180)}). Retrying in ${Math.round(delayMs / 1000)}s...`
      );
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return [];
}

async function seedSupabase(enrichedItems) {
  const rawSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseUrl = rawSupabaseUrl
    ? rawSupabaseUrl.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '')
    : '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing environment variables: set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.'
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`🚀 Upserting ${A1_THEMES.length} themes into Supabase Cloud...`);
  const { data: themesData, error: themesError } = await supabase
    .from('themes')
    .upsert(A1_THEMES, { onConflict: 'order_index' })
    .select('id, order_index');

  if (themesError) {
    throw new Error(`Themes upsert error: ${themesError.message}`);
  }

  const themeIdByOrder = new Map(themesData.map((t) => [t.order_index, t.id]));

  // Deduplicate on unique key (german, item_type) before upsert
  const uniqueRowsMap = new Map();
  for (const item of enrichedItems) {
    const themeId = themeIdByOrder.get(item.theme_order);
    if (!themeId) continue;
    const conflictKey = `${item.german}::${item.item_type}`;
    uniqueRowsMap.set(conflictKey, {
      theme_id: themeId,
      item_type: item.item_type,
      german: item.german,
      translation: item.translation,
      article: item.article,
      plural: item.plural,
      sentence_de: item.sentence_de,
      sentence_translation: item.sentence_translation,
      cloze_target: item.cloze_target,
      distractors: item.distractors,
      grammar_tip: item.grammar_tip,
    });
  }

  const rows = Array.from(uniqueRowsMap.values());
  const CHUNK_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('learning_items')
      .upsert(chunk, { onConflict: 'german,item_type' });

    if (error) {
      throw new Error(`learning_items upsert error (batch ${i}-${i + chunk.length}): ${error.message}`);
    }
    inserted += chunk.length;
    console.log(`   ↳ ${inserted}/${rows.length} items synced...`);
  }

  console.log(`✅ Supabase Cloud seeding complete: ${themesData.length} themes and ${inserted} items.`);
}

async function main() {
  const { limit, seedOnly, skipSeed } = parseCliArgs();
  const checkpoint = await loadCheckpoint();

  if (!seedOnly) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        'Missing GEMINI_API_KEY in .env. Add your Google AI Studio API key.'
      );
    }

    const corpusRaw = await fs.readFile(CORPUS_PATH, 'utf8');
    const corpus = JSON.parse(corpusRaw).slice(0, limit);
    const doneIndices = new Set(checkpoint.items.map((it) => it.source_index));
    const pending = corpus.filter((entry) => !doneIndices.has(entry.index));

    console.log(
      `📚 Corpus loaded: ${corpus.length} entries | Already enriched: ${doneIndices.size} | Remaining: ${pending.length}`
    );

    if (pending.length > 0) {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const totalBatches = Math.ceil(pending.length / BATCH_SIZE);

      for (let b = 0; b < totalBatches; b++) {
        const batch = pending.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        console.log(
          `🤖 Batch ${b + 1}/${totalBatches} (${batch.length} entries) via ${GEMINI_MODEL}...`
        );
        try {
          const enriched = await enrichBatchWithRetry(ai, batch);
          checkpoint.items.push(...enriched);
          await saveCheckpoint(checkpoint);
          console.log(
            `💾 Checkpoint saved (${checkpoint.items.length} items in data/enriched_backup.json)`
          );
          if (!skipSeed && (b + 1) % SYNC_EVERY_N_BATCHES === 0 && b < totalBatches - 1) {
            console.log(`🔄 Periodic Supabase sync (${checkpoint.items.length} items)...`);
            await seedSupabase(checkpoint.items);
          }
        } catch (err) {
          console.error(`⛔ Stopping enrichment at batch ${b + 1}/${totalBatches}: ${err.message}`);
          if (!skipSeed && checkpoint.items.length > 0) {
            console.log(`🔄 Syncing ${checkpoint.items.length} already-enriched items to Supabase before exiting...`);
            await seedSupabase(checkpoint.items);
          }
          process.exit(1);
        }
        if (b < totalBatches - 1 && BATCH_DELAY_MS > 0) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
        }
      }
    }
  } else {
    console.log(
      `📦 --seed-only mode: using local checkpoint (${checkpoint.items.length} items).`
    );
  }

  if (!skipSeed) {
    if (checkpoint.items.length === 0) {
      throw new Error('No enriched items available to push to Supabase.');
    }
    await seedSupabase(checkpoint.items);
  } else {
    console.log('⏭️  --skip-seed mode: skipping Supabase upload.');
  }
}

main().catch((err) => {
  console.error('❌ DataArchitect error:', err.message);
  process.exit(1);
});
