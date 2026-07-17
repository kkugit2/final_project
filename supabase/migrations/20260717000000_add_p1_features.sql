-- BACKEND-INTEGRATED.md 2장/2.10절 기준: P1 기능(유통기한, 완성 처리, 즐겨찾기,
-- 최근 조회, 마이페이지 통계, 커스텀 재료 등록, 영양 정보)에 필요한 스키마 확장

-- 2.3 ingredients_master: 유통기한 기본값 자동 제안(F9)
alter table public.ingredients_master
  add column if not exists default_shelf_life_days integer;

-- 2.4 user_fridge: 커스텀 재료(F2) + 유통기한(F9) 지원
alter table public.user_fridge
  alter column ingredient_id drop not null;

alter table public.user_fridge
  add column if not exists custom_name text,
  add column if not exists expiry_date date;

alter table public.user_fridge
  add constraint user_fridge_ingredient_or_custom_chk
  check (
    (ingredient_id is not null and custom_name is null)
    or (ingredient_id is null and custom_name is not null)
  );

-- 2.5 recipes(recipes_cache): 1인분 기준 영양 정보(F14)
alter table public.recipes_cache
  add column if not exists nutrition_kcal numeric,
  add column if not exists nutrition_carb numeric,
  add column if not exists nutrition_protein numeric,
  add column if not exists nutrition_fat numeric,
  add column if not exists nutrition_sodium numeric;

-- 2.2 user_profiles (건강관리 목표, P1~P2)
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  goal text,
  daily_calorie_target integer
);

alter table public.user_profiles enable row level security;

create policy "user_profiles_select_own"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "user_profiles_insert_own"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "user_profiles_update_own"
  on public.user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_profiles_delete_own"
  on public.user_profiles for delete
  using (auth.uid() = user_id);

-- 2.2-1 user_preferences (환경설정)
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  quantity_tracking_enabled boolean not null default true,
  expiry_notification_enabled boolean not null default true,
  default_category text
);

alter table public.user_preferences enable row level security;

create policy "user_preferences_select_own"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "user_preferences_insert_own"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "user_preferences_update_own"
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_preferences_delete_own"
  on public.user_preferences for delete
  using (auth.uid() = user_id);

-- 2.6 user_favorites (즐겨찾기, F12)
create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null references public.recipes_cache (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

alter table public.user_favorites enable row level security;

create policy "user_favorites_select_own"
  on public.user_favorites for select
  using (auth.uid() = user_id);

create policy "user_favorites_insert_own"
  on public.user_favorites for insert
  with check (auth.uid() = user_id);

create policy "user_favorites_delete_own"
  on public.user_favorites for delete
  using (auth.uid() = user_id);

-- 2.7 recipe_views (최근 조회, F13) — (user_id, recipe_id) unique로 upsert하여 최신순 유지
create table if not exists public.recipe_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null references public.recipes_cache (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

alter table public.recipe_views enable row level security;

create policy "recipe_views_select_own"
  on public.recipe_views for select
  using (auth.uid() = user_id);

create policy "recipe_views_insert_own"
  on public.recipe_views for insert
  with check (auth.uid() = user_id);

create policy "recipe_views_update_own"
  on public.recipe_views for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2.8 recipe_completions ("이 요리 완성했어요", F11/F14)
create table if not exists public.recipe_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null references public.recipes_cache (id) on delete cascade,
  completed_at timestamptz not null default now()
);

alter table public.recipe_completions enable row level security;

create policy "recipe_completions_select_own"
  on public.recipe_completions for select
  using (auth.uid() = user_id);

create policy "recipe_completions_insert_own"
  on public.recipe_completions for insert
  with check (auth.uid() = user_id);

-- 2.9 ingredient_consumption_log (재료 소진 이력, F14 통계용)
create table if not exists public.ingredient_consumption_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ingredient_name text not null,
  consumed_at timestamptz not null default now()
);

alter table public.ingredient_consumption_log enable row level security;

create policy "ingredient_consumption_log_select_own"
  on public.ingredient_consumption_log for select
  using (auth.uid() = user_id);

create policy "ingredient_consumption_log_insert_own"
  on public.ingredient_consumption_log for insert
  with check (auth.uid() = user_id);

create index if not exists recipe_views_user_id_viewed_at_idx
  on public.recipe_views (user_id, viewed_at desc);

create index if not exists recipe_completions_user_id_idx
  on public.recipe_completions (user_id);

create index if not exists recipe_completions_recipe_id_idx
  on public.recipe_completions (recipe_id);

create index if not exists ingredient_consumption_log_user_id_idx
  on public.ingredient_consumption_log (user_id);
