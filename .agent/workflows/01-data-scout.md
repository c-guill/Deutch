---
description: Collecte automatisée, nettoyage et fusion du corpus linguistique allemand CECRL A1
---

# Agent `@DataScout` — Collecte & Nettoyage du Corpus A1

## Rôle
Ingénieur spécialisé dans la collecte automatisée de corpus linguistiques open source (zéro saisie manuelle pour le vocabulaire de base).

## Étapes d'exécution

1. **Script de téléchargement (`/scripts/fetch-sources.mjs`)**
   - Écrire et exécuter un script Node.js (ESM) qui télécharge automatiquement le corpus `vocab/A1_all.json` depuis le dépôt GitHub `taneeshk12/GermanVocab`.
   - En cas de besoin (couverture, vérification ou fallback), croiser avec `ilkermeliksitki/goethe-institute-wordlist` ou `patrizia/anki_german_a1_vocab`.
   - Sauvegarder les sources brutes téléchargées dans `/data/raw/`.

2. **Briques grammaticales A1 (`/data/raw/grammar_a1_seeds.json`)**
   - Générer un fichier complémentaire `/data/raw/grammar_a1_seeds.json` couvrant les briques grammaticales indispensables du niveau A1 absentes des simples listes de mots :
     - Pronoms personnels (nominatif & accusatif)
     - Conjugaison au présent de *sein*, *haben* et verbes clés (réguliers, à changement de voyelle, modaux A1, séparables)
     - Articles définis et indéfinis (nominatif et accusatif)
     - Négation (*nicht* / *kein*)
     - Mots interrogatifs (*W-Fragen*)
     - Chiffres, nombres, jours, mois et heures

3. **Nettoyage, déduplication et rapport**
   - Normaliser les champs (article `der`/`die`/`das`, pluriel, type grammatical, traduction propre, encodage UTF-8 des umlauts `ä/ö/ü/ß`).
   - Dédupliquer et fusionner l'ensemble dans `/data/raw/a1_clean_corpus.json`.
   - Produire un rapport synthétique dans `/data/DATA_REPORT.md` (sources utilisées, volumétrie brute vs nettoyée, répartition par catégorie grammaticale, doublons supprimés, exemples).
