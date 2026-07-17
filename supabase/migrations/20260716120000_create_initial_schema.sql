-- Backend-Guideline.md 4장 기준 초기 스키마

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- 4.1 ingredients_master
create table if not exists public.ingredients_master (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  synonyms text[] not null default '{}',
  is_basic_seasoning boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.ingredients_master enable row level security;

create policy "ingredients_master_select_all"
  on public.ingredients_master for select
  using (true);

-- 쓰기는 service_role만 (RLS를 만족하는 정책이 없으면 anon/authenticated는 쓰기 불가, service_role은 RLS를 우회함)

-- 4.2 user_fridge
create table if not exists public.user_fridge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients_master (id) on delete cascade,
  is_owned boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (user_id, ingredient_id)
);

alter table public.user_fridge enable row level security;

create policy "user_fridge_select_own"
  on public.user_fridge for select
  using (auth.uid() = user_id);

create policy "user_fridge_insert_own"
  on public.user_fridge for insert
  with check (auth.uid() = user_id);

create policy "user_fridge_update_own"
  on public.user_fridge for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_fridge_delete_own"
  on public.user_fridge for delete
  using (auth.uid() = user_id);

-- 4.3 recipes_cache (CSV 기반, category는 RCP_PAT2 존재 확인되어 컬럼으로 포함 — UI-UX-Guideline-B.md 5.6절)
create table if not exists public.recipes_cache (
  id text primary key,
  name text not null,
  category text,
  raw_ingredients_text text not null,
  parsed_ingredients jsonb not null default '[]'::jsonb,
  matched_ingredient_ids uuid[] not null default '{}',
  cooking_steps jsonb not null default '[]'::jsonb,
  image_url text,
  loaded_at timestamptz not null default now()
);

alter table public.recipes_cache enable row level security;

create policy "recipes_cache_select_all"
  on public.recipes_cache for select
  using (true);

-- 트리거: user_fridge.updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_fridge_set_updated_at
  before update on public.user_fridge
  for each row
  execute function public.set_updated_at();
