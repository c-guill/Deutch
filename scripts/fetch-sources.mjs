import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');

const SOURCES = {
  germanVocabPrimary:
    'https://raw.githubusercontent.com/taneeshk12/GermanVocab/main/data/vocab/A1_all.json',
  goetheWordlist:
    'https://raw.githubusercontent.com/ilkermeliksitki/goethe-institute-wordlist/main/a1/a1.tsv',
};

const VALID_ARTICLES = new Set(['der', 'die', 'das']);

const PREPOSITIONS = new Set([
  'ab', 'an', 'auf', 'aus', 'bei', 'bis', 'durch', 'für', 'gegen', 'hinter',
  'in', 'mit', 'nach', 'neben', 'ohne', 'seit', 'über', 'um', 'unter', 'von',
  'vor', 'zu', 'zwischen',
]);

const CONJUNCTIONS = new Set([
  'aber', 'denn', 'oder', 'sondern', 'und', 'weil', 'dass', 'wenn', 'als', 'ob',
]);

const PRONOUNS = new Set([
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'dich', 'ihn', 'uns',
  'euch', 'mir', 'dir', 'ihm', 'ihnen', 'mein', 'dein', 'sein', 'unser', 'euer',
  'man', 'jemand', 'niemand', 'etwas', 'nichts', 'alles',
]);

async function fetchText(url, label) {
  console.log(`⬇️  Téléchargement de ${label}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Échec téléchargement ${label} (${response.status}): ${url}`);
  }
  return response.text();
}

function normalizeWhitespace(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function cleanArticle(rawArticle) {
  const cleaned = normalizeWhitespace(rawArticle || '').toLowerCase();
  if (VALID_ARTICLES.has(cleaned)) return cleaned;
  // Ex: "der/die" -> garder null si ambigu ou premier si standard
  if (cleaned === 'der/die' || cleaned === 'die/der') return 'der';
  return null;
}

function extractArticleAndHeadword(rawWord, existingArticle) {
  let word = normalizeWhitespace(rawWord);
  let article = cleanArticle(existingArticle);
  let extractedPluralSuffix = null;

  // Retirer les exemples complets entre parenthèses ex: "Deutsch (Ich spreche Deutsch.)"
  word = word.replace(/\s*\([^)]*[.!?]\s*\)/g, '').trim();
  // Retirer les numéros d'homonymes Goethe ex: "abholen(1)" -> "abholen"
  word = word.replace(/\s*\(\d+\)\s*$/g, '').trim();

  // Si le mot commence par "der ", "die ", "das " suivi d'un nom majuscule
  const articleMatch = word.match(/^(der|die|das)\s+([A-ZÄÖÜ].*)$/);
  if (articleMatch) {
    if (!article) article = articleMatch[1].toLowerCase();
    word = articleMatch[2].trim();
  }

  // Extraire les suffixes de pluriel intégrés au mot ex: "Angebot, -e" / "Apfel, ¨-" / "Alter, -" / "Eltern (Pl.)"
  const pluralSuffixMatch = word.match(/^(.+?),\s*([¨"“”\-–a-zäöüß()/\s.]+)$/i);
  if (pluralSuffixMatch && !pluralSuffixMatch[1].includes(' ')) {
    const candidateHead = pluralSuffixMatch[1].trim();
    const candidateSuffix = pluralSuffixMatch[2].trim();
    if (/^[¨"“”\-–]|\((Sg|Pl)\.\)|^(die|no plural)/i.test(candidateSuffix)) {
      word = candidateHead;
      if (/^[¨"“”\-–][a-zäöüß]+/i.test(candidateSuffix)) {
        extractedPluralSuffix = candidateSuffix;
      }
    }
  }

  // Retirer les balises "(Sg.)" / "(Pl.)" en fin de nom
  word = word.replace(/\s*\((Sg|Pl)\.\)\s*$/i, '').trim();

  return { word, article, extractedPluralSuffix };
}

function cleanPlural(rawPlural, word, itemType) {
  if (itemType !== 'noun') return null;
  const p = normalizeWhitespace(rawPlural || '');
  if (!p || p === '-' || p === '—' || p.toLowerCase() === 'none' || p.toLowerCase() === 'null') {
    return null;
  }
  // Éviter les faux pluriels manifestes (ex: noms de pays/nationalités sur des langues)
  if (p.toLowerCase() === word.toLowerCase()) return p;
  return p;
}

function inferItemType({ word, article, topic, explicitType }) {
  if (explicitType) return explicitType;
  const lower = word.toLowerCase();
  const topicLower = (topic || '').toLowerCase();

  if (article) return 'noun';
  if (topicLower === 'numbers') return 'number';
  if (PRONOUNS.has(lower)) return 'pronoun';
  if (PREPOSITIONS.has(lower)) return 'preposition';
  if (CONJUNCTIONS.has(lower)) return 'conjunction';
  if (word.includes(' ') && (word.endsWith('?') || word.endsWith('!') || word.split(' ').length >= 3)) {
    return 'phrase';
  }
  if (/^[A-ZÄÖÜ]/.test(word) && !word.includes(' ')) {
    return 'noun';
  }
  if (/^[a-zäöüß]+(en|ern|eln)$/.test(word) && word.length >= 4 && !word.includes(' ')) {
    return 'verb';
  }
  if (word.includes(' ')) {
    return 'phrase';
  }
  return 'other';
}

function parseGoetheTsv(tsvText) {
  const index = new Map();
  const lines = tsvText.split(/\r?\n/).filter((line) => line.trim().length > 0);

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    const rawHead = normalizeWhitespace(parts[0]);
    const exampleDe = normalizeWhitespace(parts[1] || '');
    const exampleEn = normalizeWhitespace(parts[2] || '');

    const { word, article } = extractArticleAndHeadword(rawHead, null);
    if (!word) continue;

    const key = word.toLowerCase();
    if (!index.has(key)) {
      index.set(key, { word, article, example_de: exampleDe, example_en: exampleEn });
    } else if (article && !index.get(key).article) {
      index.get(key).article = article;
    }
  }

  return { index, lineCount: lines.length };
}

function makeDedupKey(german, itemType) {
  const norm = normalizeWhitespace(german)
    .toLowerCase()
    .replace(/[.,!?]+$/g, '');
  // On déduplique sur le mot normalisé (en distinguant verbe vs nom homographe ex: essen / Essen)
  const group = itemType === 'noun' ? 'noun' : 'non-noun';
  return `${group}::${norm}`;
}

async function main() {
  await fs.mkdir(RAW_DIR, { recursive: true });

  // 1. Téléchargement des sources open source
  const [germanVocabRaw, goetheRaw] = await Promise.all([
    fetchText(SOURCES.germanVocabPrimary, 'taneeshk12/GermanVocab (A1_all.json)'),
    fetchText(SOURCES.goetheWordlist, 'ilkermeliksitki/goethe-institute-wordlist (a1.tsv)'),
  ]);

  await Promise.all([
    fs.writeFile(path.join(RAW_DIR, 'source_germanvocab_a1.json'), germanVocabRaw, 'utf8'),
    fs.writeFile(path.join(RAW_DIR, 'source_goethe_a1.tsv'), goetheRaw, 'utf8'),
  ]);

  const primaryEntries = JSON.parse(germanVocabRaw);
  const { index: goetheIndex, lineCount: goetheLines } = parseGoetheTsv(goetheRaw);

  // 2. Lecture des briques grammaticales A1
  const grammarPath = path.join(RAW_DIR, 'grammar_a1_seeds.json');
  const grammarSeeds = JSON.parse(await fs.readFile(grammarPath, 'utf8'));

  // 3. Nettoyage, enrichissement croisé (Goethe) et déduplication
  const dedupMap = new Map();
  let skippedInvalid = 0;
  let duplicateCount = 0;
  let goetheArticleFixes = 0;
  let goetheExampleMatches = 0;

  // Priority to A1 grammar seeds (structured in English + German)
  for (const seed of grammarSeeds) {
    const german = normalizeWhitespace(seed.german);
    const translation = normalizeWhitespace(seed.translation);
    if (!german || !translation) {
      skippedInvalid++;
      continue;
    }
    const itemType = seed.item_type || 'grammar';
    const key = makeDedupKey(german, itemType);

    dedupMap.set(key, {
      german,
      translation,
      translation_lang: 'en',
      item_type: itemType,
      article: cleanArticle(seed.article),
      plural: seed.plural ? normalizeWhitespace(seed.plural) : null,
      example_de: null,
      example_en: null,
      source_topic: seed.category || 'grammar_core',
      notes: seed.notes || null,
      source: 'grammar_a1_seeds',
    });
  }

  // Traitement du corpus principal taneeshk12/GermanVocab
  for (const raw of primaryEntries) {
    const {
      word,
      article: parsedArticle,
      extractedPluralSuffix,
    } = extractArticleAndHeadword(raw.word, raw.article);
    const meaningEn = normalizeWhitespace(raw.meaning_en || raw.meaning || '');

    if (!word || !meaningEn || word.length > 80) {
      skippedInvalid++;
      continue;
    }

    // Croisement avec la liste officielle Goethe A1 pour combler les articles ou exemples faibles
    const goetheMatch = goetheIndex.get(word.toLowerCase());
    let article = parsedArticle;
    if (!article && goetheMatch?.article) {
      article = goetheMatch.article;
      goetheArticleFixes++;
    }

    const itemType = inferItemType({
      word,
      article,
      topic: raw.topic,
      explicitType: null,
    });

    const resolvedPlural = cleanPlural(raw.plural || extractedPluralSuffix, word, itemType);

    const key = makeDedupKey(word, itemType);
    if (dedupMap.has(key)) {
      const existing = dedupMap.get(key);
      // Enrichir l'entrée existante si un champ utile manquait
      if (!existing.article && article) existing.article = article;
      if (!existing.plural && resolvedPlural) {
        existing.plural = resolvedPlural;
      }
      if (!existing.example_de && raw.example_de && raw.example_de.split(' ').length >= 3) {
        existing.example_de = normalizeWhitespace(raw.example_de);
        existing.example_en = normalizeWhitespace(raw.example_en || '');
      }
      if (goetheMatch) existing.goethe_verified = true;
      duplicateCount++;
      continue;
    }

    let exampleDe = normalizeWhitespace(raw.example_de || '');
    let exampleEn = normalizeWhitespace(raw.example_en || '');
    // Si l'exemple de GermanVocab est trop pauvre (ex: "eins."), préférer celui du Goethe-Institut
    if ((!exampleDe || exampleDe.split(' ').length < 3) && goetheMatch?.example_de) {
      exampleDe = goetheMatch.example_de;
      exampleEn = goetheMatch.example_en || exampleEn;
      goetheExampleMatches++;
    }

    dedupMap.set(key, {
      german: word,
      translation: meaningEn,
      translation_lang: 'en',
      item_type: itemType,
      article,
      plural: resolvedPlural,
      example_de: exampleDe || null,
      example_en: exampleEn || null,
      source_topic: normalizeWhitespace(raw.topic || 'general') || 'general',
      notes: null,
      source: 'taneeshk12/GermanVocab',
      goethe_verified: Boolean(goetheMatch),
    });
  }

  // Trier proprement : d'abord les briques grammaticales, puis les mots vérifiés Goethe, puis alphabétique
  const cleanCorpus = Array.from(dedupMap.values()).sort((a, b) => {
    if (a.source === 'grammar_a1_seeds' && b.source !== 'grammar_a1_seeds') return -1;
    if (a.source !== 'grammar_a1_seeds' && b.source === 'grammar_a1_seeds') return 1;
    if (Boolean(a.goethe_verified) !== Boolean(b.goethe_verified)) {
      return a.goethe_verified ? -1 : 1;
    }
    return a.german.localeCompare(b.german, 'de');
  });

  // Assigner un identifiant stable pour le checkpointing
  const finalCorpus = cleanCorpus.map((item, idx) => ({
    index: idx + 1,
    ...item,
  }));

  const outPath = path.join(RAW_DIR, 'a1_clean_corpus.json');
  await fs.writeFile(outPath, JSON.stringify(finalCorpus, null, 2), 'utf8');

  // 4. Statistiques & Rapport /data/DATA_REPORT.md
  const byType = {};
  const bySource = {};
  const byTopic = {};
  let withArticle = 0;
  let withPlural = 0;
  let goetheVerifiedCount = 0;

  for (const item of finalCorpus) {
    byType[item.item_type] = (byType[item.item_type] || 0) + 1;
    bySource[item.source] = (bySource[item.source] || 0) + 1;
    byTopic[item.source_topic] = (byTopic[item.source_topic] || 0) + 1;
    if (item.article) withArticle++;
    if (item.plural) withPlural++;
    if (item.goethe_verified) goetheVerifiedCount++;
  }

  const formatTable = (obj, limit = 20) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([k, v]) => `| \`${k}\` | ${v} |`)
      .join('\n');

  const sampleRows = [
    ...finalCorpus.filter((i) => i.source === 'grammar_a1_seeds').slice(0, 5),
    ...finalCorpus.filter((i) => i.article && i.goethe_verified).slice(0, 5),
  ]
    .map(
      (i) =>
        `| ${i.article ? `**${i.article}** ` : ''}${i.german} | ${i.translation} | \`${i.item_type}\` | \`${i.source}\` |`
    )
    .join('\n');

  const report = `# Rapport de Collecte & Nettoyage du Corpus A1 (\`@DataScout\`)

Généré automatiquement par \`scripts/fetch-sources.mjs\` le ${new Date().toISOString()}.

## 1. Sources collectées

| Source | Rôle | Entrées brutes |
| --- | --- | ---: |
| \`taneeshk12/GermanVocab\` (\`data/vocab/A1_all.json\`) | Corpus principal vocabulaire A1 | ${primaryEntries.length} |
| \`ilkermeliksitki/goethe-institute-wordlist\` (\`a1/a1.tsv\`) | Vérification croisée Goethe-Institut (articles & exemples) | ${goetheLines} |
| \`data/raw/grammar_a1_seeds.json\` | Briques grammaticales A1 (pronoms, conjugaisons, articles, négation, W-Fragen, heures) | ${grammarSeeds.length} |

## 2. Synthèse du nettoyage

- **Total final dans \`data/raw/a1_clean_corpus.json\`** : **${finalCorpus.length}** notions uniques
- **Doublons fusionnés / supprimés** : ${duplicateCount}
- **Entrées invalides écartées** : ${skippedInvalid}
- **Notions confirmées dans la liste officielle Goethe A1** : ${goetheVerifiedCount}
- **Articles (\`der\`/\`die\`/\`das\`) complétés via Goethe** : ${goetheArticleFixes}
- **Exemples enrichis via Goethe** : ${goetheExampleMatches}
- **Total d'entrées avec article renseigné** : ${withArticle}
- **Total d'entrées avec pluriel renseigné** : ${withPlural}

> Note: All translations in \`a1_clean_corpus.json\` are in English (\`translation_lang: "en"\`) and target entries are in German (100% English & German — no French). The \`@DataArchitect\` pipeline (\`scripts/enrich-and-seed.mjs\`) classifies each item into the 18 A1 themes and generates A1 German example sentences, English translations, cloze targets, 3 German distractors, and English grammar tips.

## 3. Répartition par type grammatical (\`item_type\`)

| Type | Nombre |
| --- | ---: |
${formatTable(byType)}

## 4. Répartition par source

| Source | Nombre |
| --- | ---: |
${formatTable(bySource)}

## 5. Top 20 des thèmes bruts (\`source_topic\`)

| Thème brut | Nombre |
| --- | ---: |
${formatTable(byTopic, 20)}

## 6. Échantillon du corpus nettoyé

| Allemand | Traduction brute | Type | Source |
| --- | --- | --- | --- |
${sampleRows}
`;

  await fs.writeFile(path.join(DATA_DIR, 'DATA_REPORT.md'), report, 'utf8');

  console.log(`✅ Corpus nettoyé sauvegardé : ${outPath} (${finalCorpus.length} entrées)`);
  console.log(`📊 Rapport généré : ${path.join(DATA_DIR, 'DATA_REPORT.md')}`);
}

main().catch((err) => {
  console.error('❌ Erreur DataScout :', err);
  process.exit(1);
});
