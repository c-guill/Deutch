-- =============================================================================
-- Migration 002 : Sous-modules progressifs par thème (6 à 9 mots par module)
-- Exécutable de manière idempotente dans le SQL Editor de Supabase Cloud.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table des sous-modules (rattachés à un thème parent)
-- -----------------------------------------------------------------------------
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  theme_id int not null references public.themes(id) on delete cascade,
  order_index int not null,
  title text not null,
  description text not null default '',
  constraint modules_theme_order_unique unique (theme_id, order_index)
);

-- -----------------------------------------------------------------------------
-- 2. Colonne module_id sur learning_items (ON DELETE SET NULL pour ne jamais
--    supprimer les learning_items ni perdre user_progress lors d'un re-découpage)
-- -----------------------------------------------------------------------------
alter table public.learning_items
  add column if not exists module_id uuid references public.modules(id) on delete set null;

-- -----------------------------------------------------------------------------
-- 3. Index de performance
-- -----------------------------------------------------------------------------
create index if not exists idx_modules_theme_id
  on public.modules (theme_id, order_index);

create index if not exists idx_learning_items_module_id
  on public.learning_items (module_id);

-- -----------------------------------------------------------------------------
-- 4. Politique Row Level Security (RLS) — lecture publique comme themes
-- -----------------------------------------------------------------------------
alter table public.modules enable row level security;

drop policy if exists "Public read modules" on public.modules;
create policy "Public read modules"
  on public.modules
  for select
  to anon, authenticated
  using (true);
