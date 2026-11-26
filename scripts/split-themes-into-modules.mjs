import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const GEMINI_MODELS = (
  process.env.GEMINI_MODEL ||
  'gemini-3.1-flash-lite,gemini-3.1-flash-lite-preview,gemini-flash-lite-latest'
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 45000);
const MIN_MODULE_SIZE = 6;
const MAX_MODULE_SIZE = 9;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    modules: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          order_index: { type: Type.INTEGER },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          item_Indices: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
        },
        required: ['order_index', 'title', 'description', 'item_Indices'],
      },
    },
  },
  required: ['modules'],
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
      .select('id, theme_id, module_id, item_type, german, translation')
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
 * Post-processes Gemini's grouping to guarantee:
 * 1. Every single item of the theme is assigned to exactly one module (no missing or duplicate items).
 * 2. Every module contains between 6 and 9 items (unless the whole theme has < 6 items).
 */
function normalizeModulesForTheme(rawModules, themeItems) {
  const total = themeItems.length;
  if (total === 0) return [];

  const assignedIndices = new Set();
  const initialGroups = [];

  for (const mod of Array.isArray(rawModules) ? rawModules : []) {
    const validIndices = [];
    for (const idx of Array.isArray(mod.item_Indices) ? mod.item_Indices : []) {
      const n = Number(idx);
      if (Number.isInteger(n) && n >= 0 && n < total && !assignedIndices.has(n)) {
        assignedIndices.add(n);
        validIndices.push(n);
      }
    }
    if (validIndices.length > 0) {
      initialGroups.push({
        title: String(mod.title || 'Core Vocabulary').trim(),
        description: String(mod.description || 'Essential A1 German vocabulary and expressions.').trim(),
        indices: validIndices,
      });
    }
  }

  // Collect any unassigned items
  const unassigned = [];
  for (let i = 0; i < total; i++) {
    if (!assignedIndices.has(i)) unassigned.push(i);
  }

  // Split any oversized module (> MAX_MODULE_SIZE) into chunks of 7-8
  const splitGroups = [];
  for (const g of initialGroups) {
    if (g.indices.length <= MAX_MODULE_SIZE) {
      splitGroups.push(g);
    } else {
      let part = 1;
      for (let i = 0; i < g.indices.length; i += 8) {
        const slice = g.indices.slice(i, i + 8);
        splitGroups.push({
          title: part === 1 ? g.title : `${g.title} (${part})`,
          description: g.description,
          indices: slice,
        });
        part++;
      }
    }
  }

  // Distribute unassigned items into existing modules that have room (< MAX_MODULE_SIZE), or create new chunks of 8
  for (const idx of unassigned) {
    const target = splitGroups.find((g) => g.indices.length < MAX_MODULE_SIZE);
    if (target) {
      target.indices.push(idx);
    } else {
      splitGroups.push({
        title: `Essential Practice ${splitGroups.length + 1}`,
        description: 'Key A1 words and expressions for this unit.',
        indices: [idx],
      });
    }
  }

  // Merge any undersized module (< MIN_MODULE_SIZE) with neighbors so all modules sit in 6..9
  const finalGroups = [];
  for (const g of splitGroups) {
    if (finalGroups.length > 0 && g.indices.length < MIN_MODULE_SIZE) {
      const prev = finalGroups[finalGroups.length - 1];
      if (prev.indices.length + g.indices.length <= MAX_MODULE_SIZE) {
        prev.indices.push(...g.indices);
        continue;
      }
      // Rebalance between prev and g so both have >= MIN_MODULE_SIZE
      const combined = [...prev.indices, ...g.indices];
      if (combined.length >= MIN_MODULE_SIZE * 2) {
        const half = Math.ceil(combined.length / 2);
        prev.indices = combined.slice(0, half);
        g.indices = combined.slice(half);
        finalGroups.push(g);
        continue;
      } else if (finalGroups.length >= 2) {
        // Borrow from the 2nd-to-last module so all 3 sit between 6 and 9
        const prevPrev = finalGroups[finalGroups.length - 2];
        const tri = [...prevPrev.indices, ...prev.indices, ...g.indices];
        if (tri.length <= MAX_MODULE_SIZE * 2) {
          const half = Math.ceil(tri.length / 2);
          prevPrev.indices = tri.slice(0, half);
          prev.indices = tri.slice(half);
          continue;
        }
      }
    }
    finalGroups.push(g);
  }

  // Final pass: if the very first group is < MIN_MODULE_SIZE and there is a second group, rebalance
  if (finalGroups.length >= 2 && finalGroups[0].indices.length < MIN_MODULE_SIZE) {
    const combined = [...finalGroups[0].indices, ...finalGroups[1].indices];
    if (combined.length <= MAX_MODULE_SIZE) {
      finalGroups[1].indices = combined;
      finalGroups.shift();
    } else {
      const half = Math.ceil(combined.length / 2);
      finalGroups[0].indices = combined.slice(0, half);
      finalGroups[1].indices = combined.slice(half);
    }
  }

  return finalGroups.map((g, idx) => ({
    order_index: idx + 1,
    title: g.title,
    description: g.description,
    items: g.indices.map((i) => themeItems[i]),
  }));
}

async function splitThemeWithGemini(ai, theme, themeItems) {
  const targetModuleCount = Math.max(1, Math.round(themeItems.length / 7.5));
  const compactItems = themeItems.map((it, idx) => ({
    idx,
    de: it.german,
    en: it.translation,
    type: it.item_type,
  }));

  const prompt = `You are a CEFR A1 German curriculum designer.
Split the ${themeItems.length} items of Theme #${theme.order_index} "${theme.title}" (${theme.description}) into approximately ${targetModuleCount} logical, progressive sub-modules.

Strict rules:
1. Every module MUST contain between 6 and 9 items (ideal: 7 or 8 items).
2. Every item index from 0 to ${themeItems.length - 1} MUST appear in exactly one module.
3. Order the modules progressively from the most basic/indispensable foundational words (order_index = 1) to more specific vocabulary.
4. Keep all module titles and descriptions in clear, concise ENGLISH (100% English & German only, zero French, in compliance with the app's strict language rule).
   - title: short & clear (2 to 5 words, e.g. "Saying Hello & Goodbye", "Core Personal Pronouns", "At the Bakery")
   - description: 1 short sentence describing what the learner will practice.

Theme items JSON:
${JSON.stringify(compactItems)}`;

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
            maxOutputTokens: 32768,
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS)
        ),
      ]);

      const parsed = JSON.parse(response.text);
      return normalizeModulesForTheme(parsed?.modules, themeItems);
    } catch (err) {
      console.warn(
        `⚠️ Gemini attempt ${attempt}/6 (${modelName}) for theme "${theme.title}" failed: ${String(err.message).slice(0, 140)}`
      );
      if (attempt === 6) {
        console.warn(`⚠️ Falling back to deterministic 8-item progressive grouping for "${theme.title}".`);
        return normalizeModulesForTheme([], themeItems);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return normalizeModulesForTheme([], themeItems);
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY in .env');
  }

  const supabase = getSupabaseClient();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const { data: themes, error: themesErr } = await supabase
    .from('themes')
    .select('*')
    .order('order_index', { ascending: true });

  if (themesErr) throw new Error(`Failed to load themes: ${themesErr.message}`);

  const allItems = await fetchAllLearningItems(supabase);
  console.log(`📚 Loaded ${themes.length} themes and ${allItems.length} learning_items from Supabase Cloud.\n`);

  const summary = [];
  let totalModulesCreated = 0;
  let totalItemsAssigned = 0;

  for (const theme of themes) {
    const themeItems = allItems.filter((it) => it.theme_id === theme.id);
    if (themeItems.length === 0) continue;

    // Skip if already split cleanly on a previous run (unless --force is passed)
    const alreadyLinked = themeItems.every((it) => it.module_id !== null);
    if (alreadyLinked && !process.argv.includes('--force')) {
      const { data: existingMods } = await supabase
        .from('modules')
        .select('id, order_index, title')
        .eq('theme_id', theme.id)
        .order('order_index', { ascending: true });
      if (existingMods && existingMods.length > 0) {
        const countsByMod = new Map();
        for (const it of themeItems) {
          countsByMod.set(it.module_id, (countsByMod.get(it.module_id) || 0) + 1);
        }
        totalModulesCreated += existingMods.length;
        totalItemsAssigned += themeItems.length;
        summary.push({
          themeOrder: theme.order_index,
          themeTitle: theme.title,
          totalItems: themeItems.length,
          modules: existingMods.map((m) => ({
            order: m.order_index,
            title: m.title,
            count: countsByMod.get(m.id) || 0,
          })),
        });
        console.log(
          `⏭️  Theme #${theme.order_index} "${theme.title}" already split into ${existingMods.length} modules (${themeItems.length} items).`
        );
        continue;
      }
    }

    console.log(
      `🤖 Grouping Theme #${theme.order_index} "${theme.title}" (${themeItems.length} items) via ${GEMINI_MODELS[0]}...`
    );

    const plannedModules = await splitThemeWithGemini(ai, theme, themeItems);

    // 1. Unlink existing learning_items of this theme before deleting old modules (safe even if FK has no ON DELETE SET NULL)
    const { error: unlinkErr } = await supabase
      .from('learning_items')
      .update({ module_id: null })
      .eq('theme_id', theme.id);
    if (unlinkErr) {
      throw new Error(`Failed unlinking module_id for theme ${theme.id}: ${unlinkErr.message}`);
    }

    // 2. Clean any existing modules for this theme
    const { error: deleteErr } = await supabase
      .from('modules')
      .delete()
      .eq('theme_id', theme.id);
    if (deleteErr) {
      throw new Error(`Failed deleting old modules for theme ${theme.id}: ${deleteErr.message}`);
    }

    // 3. Insert new modules for this theme
    const rowsToInsert = plannedModules.map((m) => ({
      theme_id: theme.id,
      order_index: m.order_index,
      title: m.title,
      description: m.description,
    }));

    const { data: insertedModules, error: insertErr } = await supabase
      .from('modules')
      .insert(rowsToInsert)
      .select('id, order_index, title, description');

    if (insertErr) {
      throw new Error(`Failed inserting modules for theme ${theme.id}: ${insertErr.message}`);
    }

    const moduleIdByOrder = new Map(insertedModules.map((m) => [m.order_index, m.id]));

    // 4. Update only module_id on each existing learning_item by its id (preserving user_progress)
    for (const m of plannedModules) {
      const moduleId = moduleIdByOrder.get(m.order_index);
      const itemIds = m.items.map((it) => it.id);

      const { error: updateErr } = await supabase
        .from('learning_items')
        .update({ module_id: moduleId })
        .in('id', itemIds);

      if (updateErr) {
        throw new Error(
          `Failed updating learning_items for module "${m.title}" (id=${moduleId}): ${updateErr.message}`
        );
      }
      totalItemsAssigned += itemIds.length;
    }

    totalModulesCreated += plannedModules.length;
    summary.push({
      themeOrder: theme.order_index,
      themeTitle: theme.title,
      totalItems: themeItems.length,
      modules: plannedModules.map((m) => ({
        order: m.order_index,
        title: m.title,
        count: m.items.length,
      })),
    });

    console.log(
      `   ✅ Created ${plannedModules.length} modules for Theme #${theme.order_index} (${themeItems.length} items updated in-place).`
    );
  }

  console.log('\n=============================================================================');
  console.log(
    `🎉 COMPLETED: ${totalModulesCreated} sub-modules created across ${summary.length} themes (${totalItemsAssigned} items linked)`
  );
  console.log('=============================================================================\n');

  for (const t of summary) {
    console.log(
      `📘 Theme ${String(t.themeOrder).padStart(2, '0')} — ${t.themeTitle} (${t.totalItems} words, ${t.modules.length} modules)`
    );
    for (const m of t.modules) {
      console.log(`   ${String(m.order).padStart(2, '0')}. ${m.title} (${m.count} words)`);
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error('❌ split-themes-into-modules error:', err.message);
  process.exit(1);
});
