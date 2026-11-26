-- =============================================================================
-- Migration 003 : Statistiques utilisateur (user_stats) & Mini-dialogues A1
-- (theme_dialogues) par thème.
-- Exécutable de manière idempotente dans le SQL Editor de Supabase Cloud.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table des statistiques globales de l'apprenant (XP & série quotidienne)
-- -----------------------------------------------------------------------------
create table if not exists public.user_stats (
  id int primary key default 1,
  xp int not null default 0,
  streak_days int not null default 0,
  last_activity_date date,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Table des mini-dialogues interactifs par thème (4 à 5 répliques A1)
-- -----------------------------------------------------------------------------
create table if not exists public.theme_dialogues (
  id uuid primary key default gen_random_uuid(),
  theme_id int not null unique references public.themes(id) on delete cascade,
  title text not null,
  context text not null,
  turns jsonb not null default '[]'::jsonb
);

-- -----------------------------------------------------------------------------
-- 3. Index de performance
-- -----------------------------------------------------------------------------
create index if not exists idx_theme_dialogues_theme_id
  on public.theme_dialogues (theme_id);

-- -----------------------------------------------------------------------------
-- 4. Politiques Row Level Security (RLS) cohérentes avec 001_init_schema.sql
-- -----------------------------------------------------------------------------
alter table public.user_stats enable row level security;
alter table public.theme_dialogues enable row level security;

-- Lecture publique des mini-dialogues (écritures via service_role)
drop policy if exists "Public read theme_dialogues" on public.theme_dialogues;
create policy "Public read theme_dialogues"
  on public.theme_dialogues
  for select
  to anon, authenticated
  using (true);

-- Lecture / écriture mono-apprenant sur user_stats (comme user_progress)
drop policy if exists "Allow read user_stats" on public.user_stats;
create policy "Allow read user_stats"
  on public.user_stats
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow insert user_stats" on public.user_stats;
create policy "Allow insert user_stats"
  on public.user_stats
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Allow update user_stats" on public.user_stats;
create policy "Allow update user_stats"
  on public.user_stats
  for update
  to anon, authenticated
  using (true)
  with check (true);
