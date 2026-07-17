import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

function escapeLikePattern(value: string) {
  return value.replace(/[%_\\]/g, (match) => `\\${match}`);
}

export async function searchIngredients(
  supabase: SupabaseClient<Database>,
  query: string,
  limit = 10
) {
  const { data, error } = await supabase
    .from("ingredients_master")
    .select("id, name, category, is_basic_seasoning, default_shelf_life_days")
    .ilike("name", `%${escapeLikePattern(query)}%`)
    .order("name")
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getIngredientNameMap(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase.from("ingredients_master").select("id, name");
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.id, row.name]));
}

export async function getBasicSeasoningIds(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from("ingredients_master")
    .select("id")
    .eq("is_basic_seasoning", true);

  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}
