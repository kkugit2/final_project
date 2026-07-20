-- user_fridge: 보관 위치(냉장/냉동/실온) 구분 (조미료 표시 및 보관 위치 기능)
alter table public.user_fridge
  add column if not exists storage_location text not null default '냉장';

alter table public.user_fridge
  add constraint user_fridge_storage_location_chk
  check (storage_location in ('냉장', '냉동', '실온'));
