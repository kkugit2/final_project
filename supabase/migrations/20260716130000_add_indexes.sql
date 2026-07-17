-- Backend-Guideline.md 4.1절: 검색/매칭 성능을 위한 인덱스

create index if not exists ingredients_master_name_trgm_idx
  on public.ingredients_master using gin (name gin_trgm_ops);

create index if not exists ingredients_master_synonyms_gin_idx
  on public.ingredients_master using gin (synonyms);

create index if not exists user_fridge_user_id_idx
  on public.user_fridge (user_id);

create index if not exists recipes_cache_matched_ingredient_ids_gin_idx
  on public.recipes_cache using gin (matched_ingredient_ids);

create index if not exists recipes_cache_category_idx
  on public.recipes_cache (category);
