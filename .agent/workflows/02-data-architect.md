---
description: Schéma PostgreSQL Supabase Cloud et pipeline d'enrichissement IA Gemini vers Supabase
---

# Agent `@DataArchitect` — Schéma Supabase Cloud & Enrichissement IA

## Rôle
Architecte PostgreSQL Supabase Cloud et pipelines d'enrichissement IA.

## Étapes d'exécution

1. **Migration SQL Supabase Cloud (`/supabase/migrations/001_init_schema.sql`)**
   Créer une migration SQL idempotente et prête à être exécutée dans le SQL Editor de Supabase Cloud avec :
   - Table `themes` :
     - `id` `serial primary key`
     - `order_index` `int unique not null`
     - `title` `text not null`
     - `description` `text not null`
     - `grammar_focus` `text not null`
   - Table `learning_items` :
     - `id` `uuid primary key default gen_random_uuid()`
     - `theme_id` `int not null references themes(id) on delete cascade`
     - `item_type` `text not null`
     - `german` `text not null`
     - `translation` `text not null`
     - `article` `text`
     - `plural` `text`
     - `sentence_de` `text not null`
     - `sentence_translation` `text not null`
     - `cloze_target` `text not null`
     - `distractors` `jsonb not null default '[]'::jsonb`
     - `grammar_tip` `text not null`
   - Table `user_progress` :
     - `item_id` `uuid primary key references learning_items(id) on delete cascade`
     - `repetitions` `int not null default 0`
     - `interval_days` `float not null default 0`
     - `ease_factor` `float not null default 2.5`
     - `next_review_at` `timestamptz not null default now()`
     - `last_exercise_type` `text`
   - **Index** sur `learning_items(theme_id)` et `user_progress(next_review_at)` (plus contrainte unique permettant l'`upsert` idempotent sur `learning_items`).
   - **Politiques RLS** adaptées à Supabase Cloud (lecture publique des tables de contenu `themes` et `learning_items`, lecture/écriture maîtrisée sur `user_progress` pour le client anon/authentifié).

2. **Script d'enrichissement et de seeding (`/scripts/enrich-and-seed.mjs`)**
   - Utiliser le SDK officiel `@google/genai` avec **Structured Outputs (JSON Schema)** et `@supabase/supabase-js`.
   - Être totalement **idempotent** et résilient (reprise sur checkpoint).
   - Lire `/data/raw/a1_clean_corpus.json` par lots de **25 entrées**.
   - Pour chaque entrée :
     - Classer dans l'un des **18 thèmes progressifs A1** (titres, descriptions et `grammar_focus` en anglais + exemples allemands ; insérer/mettre à jour ces 18 thèmes dans `themes`).
     - Générer une phrase simple niveau A1 (`sentence_de`) et sa traduction **en anglais** (`sentence_translation`, jamais en français).
     - Vérifier que `translation` est en **anglais** naturel et concis.
     - Déterminer le mot ou groupe cible à masquer (`cloze_target`) présent dans `sentence_de`.
     - Générer **3 distracteurs plausibles** en allemand de même nature grammaticale (`distractors`).
     - Rédiger une astuce grammaticale concise **en anglais** (`grammar_tip`).
   - Sauvegarder un checkpoint local incrémental dans `/data/enriched_backup.json`.
   - Pousser les données par `upsert` vers l'instance **Supabase Cloud** via `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`.
