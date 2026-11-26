# Rapport de Collecte & Nettoyage du Corpus A1 (`@DataScout`)

Généré automatiquement par `scripts/fetch-sources.mjs` le 2026-11-26T14:04:12.013Z.

## 1. Sources collectées

| Source | Rôle | Entrées brutes |
| --- | --- | ---: |
| `taneeshk12/GermanVocab` (`data/vocab/A1_all.json`) | Corpus principal vocabulaire A1 | 2035 |
| `ilkermeliksitki/goethe-institute-wordlist` (`a1/a1.tsv`) | Vérification croisée Goethe-Institut (articles & exemples) | 847 |
| `data/raw/grammar_a1_seeds.json` | Briques grammaticales A1 (pronoms, conjugaisons, articles, négation, W-Fragen, heures) | 77 |

## 2. Synthèse du nettoyage

- **Total final dans `data/raw/a1_clean_corpus.json`** : **1974** notions uniques
- **Doublons fusionnés / supprimés** : 136
- **Entrées invalides écartées** : 2
- **Notions confirmées dans la liste officielle Goethe A1** : 465
- **Articles (`der`/`die`/`das`) complétés via Goethe** : 5
- **Exemples enrichis via Goethe** : 21
- **Total d'entrées avec article renseigné** : 1096
- **Total d'entrées avec pluriel renseigné** : 1109

> Note: All translations in `a1_clean_corpus.json` are in English (`translation_lang: "en"`) and target entries are in German (100% English & German — no French). The `@DataArchitect` pipeline (`scripts/enrich-and-seed.mjs`) classifies each item into the 18 A1 themes and generates A1 German example sentences, English translations, cloze targets, 3 German distractors, and English grammar tips.

## 3. Répartition par type grammatical (`item_type`)

| Type | Nombre |
| --- | ---: |
| `noun` | 1122 |
| `other` | 284 |
| `phrase` | 261 |
| `verb` | 185 |
| `grammar` | 44 |
| `number` | 30 |
| `preposition` | 22 |
| `pronoun` | 21 |
| `conjunction` | 5 |

## 4. Répartition par source

| Source | Nombre |
| --- | ---: |
| `taneeshk12/GermanVocab` | 1897 |
| `grammar_a1_seeds` | 77 |

## 5. Top 20 des thèmes bruts (`source_topic`)

| Thème brut | Nombre |
| --- | ---: |
| `basics` | 1402 |
| `food` | 110 |
| `work` | 76 |
| `verbs` | 49 |
| `transport` | 35 |
| `family` | 31 |
| `countries` | 30 |
| `body` | 28 |
| `time` | 28 |
| `numbers` | 24 |
| `colors` | 24 |
| `calendar` | 24 |
| `numbers_and_time` | 20 |
| `adjectives` | 18 |
| `personal_pronouns` | 14 |
| `key_verbs` | 11 |
| `w_questions` | 9 |
| `articles_nom_acc` | 7 |
| `directions` | 7 |
| `conjugation_sein` | 6 |

## 6. Échantillon du corpus nettoyé

| Allemand | Traduction brute | Type | Source |
| --- | --- | --- | --- |
| dich | you (accusative informal) | `pronoun` | `grammar_a1_seeds` |
| er | he | `pronoun` | `grammar_a1_seeds` |
| es | it | `pronoun` | `grammar_a1_seeds` |
| ich | I | `pronoun` | `grammar_a1_seeds` |
| nicht | not (negates verbs, adjectives, adverbs) | `grammar` | `grammar_a1_seeds` |
| **die** Abfahrt | departure | `noun` | `taneeshk12/GermanVocab` |
| **der** Absender | sender | `noun` | `taneeshk12/GermanVocab` |
| **die** Adresse | address | `noun` | `taneeshk12/GermanVocab` |
| **das** Alter | age | `noun` | `taneeshk12/GermanVocab` |
| **der** Anfang | beginning | `noun` | `taneeshk12/GermanVocab` |
