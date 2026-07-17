import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { NotFoundError, ConflictError } from "@/lib/utils/errors";

const FRIDGE_ITEM_COLUMNS =
  "id, is_owned, expiry_date, updated_at, custom_name, ingredient:ingredients_master(id, name, category, is_basic_seasoning)";

export async function listFridgeItems(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("user_fridge")
    .select(FRIDGE_ITEM_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// F9: 재료 등록 시 카테고리 기준 기본 유통기한을 자동 계산해 제안 (오늘 날짜 + 기본 일수)
async function suggestExpiryDate(supabase: SupabaseClient<Database>, ingredientId: string) {
  const { data, error } = await supabase
    .from("ingredients_master")
    .select("default_shelf_life_days")
    .eq("id", ingredientId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.default_shelf_life_days) return null;

  const suggested = new Date();
  suggested.setDate(suggested.getDate() + data.default_shelf_life_days);
  return suggested.toISOString().slice(0, 10);
}

export interface AddFridgeItemParams {
  ingredientId?: string;
  customName?: string;
  expiryDate?: string | null;
}

export async function addFridgeItem(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: AddFridgeItemParams
) {
  if (params.ingredientId) {
    const expiryDate =
      params.expiryDate !== undefined
        ? params.expiryDate
        : await suggestExpiryDate(supabase, params.ingredientId);

    const { data, error } = await supabase
      .from("user_fridge")
      .upsert(
        {
          user_id: userId,
          ingredient_id: params.ingredientId,
          is_owned: true,
          expiry_date: expiryDate,
        },
        { onConflict: "user_id,ingredient_id" }
      )
      .select(FRIDGE_ITEM_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23503") throw new ConflictError("존재하지 않는 재료입니다.");
      throw error;
    }

    return data;
  }

  // 검색 결과에 없어 사용자가 직접 입력한 커스텀 재료 (F2)
  const { data, error } = await supabase
    .from("user_fridge")
    .insert({
      user_id: userId,
      custom_name: params.customName,
      is_owned: true,
      expiry_date: params.expiryDate ?? null,
    })
    .select(FRIDGE_ITEM_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

async function findFridgeItemOwner(supabase: SupabaseClient<Database>, id: string) {
  const { data, error } = await supabase
    .from("user_fridge")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new NotFoundError("냉장고 항목을 찾을 수 없습니다.");
  return data;
}

export async function assertFridgeItemOwnership(
  supabase: SupabaseClient<Database>,
  id: string,
  userId: string
) {
  const item = await findFridgeItemOwner(supabase, id);
  return item.user_id === userId;
}

export interface UpdateFridgeItemParams {
  isOwned?: boolean;
  expiryDate?: string | null;
}

export async function updateFridgeItem(
  supabase: SupabaseClient<Database>,
  id: string,
  updates: UpdateFridgeItemParams
) {
  const payload: Database["public"]["Tables"]["user_fridge"]["Update"] = {};
  if (updates.isOwned !== undefined) payload.is_owned = updates.isOwned;
  if (updates.expiryDate !== undefined) payload.expiry_date = updates.expiryDate;

  const { data, error } = await supabase
    .from("user_fridge")
    .update(payload)
    .eq("id", id)
    .select(FRIDGE_ITEM_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFridgeItem(supabase: SupabaseClient<Database>, id: string) {
  const { error } = await supabase.from("user_fridge").delete().eq("id", id);
  if (error) throw error;
}
