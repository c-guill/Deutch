-- =============================================================================
-- Migration 001 : Schéma initial Deutsch A1 (Supabase Cloud / PostgreSQL)
-- Exécutable de manière idempotente dans le SQL Editor de Supabase Cloud.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Table des thèmes progressifs CECRL A1 (15 à 18 thèmes)
-- -----------------------------------------------------------------------------
create table if not exists public.themes (
  id serial primary key,
  order_index int not null unique,
  title text not null,
  description text not null,
  grammar_focus text not null
);

-- -----------------------------------------------------------------------------
-- 2. Table des notions d'apprentissage (vocabulaire + briques grammaticales)
-- -----------------------------------------------------------------------------
create table if not exists public.learning_items (
  id uuid primary key default gen_random_uuid(),
  theme_id int not null references public.themes(id) on delete cascade,
  item_type text not null,
  german text not null,
  translation text not null,
  article text check (article is null or article in ('der', 'die', 'das')),
  plural text,
  sentence_de text not null,
  sentence_translation text not null,
  cloze_target text not null,
  distractors jsonb not null default '[]'::jsonb,
  grammar_tip text not null,
  constraint learning_items_german_type_unique unique (german, item_type)
);

-- -----------------------------------------------------------------------------
-- 3. Table de progression SRS (algorithme SM-2)
-- -----------------------------------------------------------------------------
create table if not exists public.user_progress (
  item_id uuid primary key references public.learning_items(id) on delete cascade,
  repetitions int not null default 0,
  interval_days float not null default 0,
  ease_factor float not null default 2.5,
  next_review_at timestamptz not null default now(),
  last_exercise_type text
);

-- -----------------------------------------------------------------------------
-- 4. Index de performance
-- -----------------------------------------------------------------------------
create index if not exists idx_learning_items_theme_id
  on public.learning_items (theme_id);

create index if not exists idx_user_progress_next_review_at
  on public.user_progress (next_review_at);

-- -----------------------------------------------------------------------------
-- 5. Politiques Row Level Security (RLS) pour Supabase Cloud
-- -----------------------------------------------------------------------------
alter table public.themes enable row level security;
alter table public.learning_items enable row level security;
alter table public.user_progress enable row level security;

-- Lecture publique du contenu pédagogique (les écritures passent par service_role)
drop policy if exists "Public read themes" on public.themes;
create policy "Public read themes"
  on public.themes
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read learning_items" on public.learning_items;
create policy "Public read learning_items"
  on public.learning_items
  for select
  to anon, authenticated
  using (true);

-- Progression de l'apprenant (mode mono-apprenant PWA sans authentification obligatoire).
-- Si vous activez Supabase Auth plus tard, ajoutez une colonne user_id uuid = auth.uid()
-- et remplacez `using (true)` par `using (auth.uid() = user_id)`.
drop policy if exists "Allow read user_progress" on public.user_progress;
create policy "Allow read user_progress"
  on public.user_progress
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow insert user_progress" on public.user_progress;
create policy "Allow insert user_progress"
  on public.user_progress
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Allow update user_progress" on public.user_progress;
create policy "Allow update user_progress"
  on public.user_progress
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Allow delete user_progress" on public.user_progress;
create policy "Allow delete user_progress"
  on public.user_progress
  for delete
  to anon, authenticated
  using (true);
