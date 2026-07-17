import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { NotFoundError } from "@/lib/utils/errors";
import { getIngredientNameMap } from "./ingredient-service";

// F13: 조회 기록 upsert — (user_id, recipe_id) unique라 같은 레시피를 여러 번 봐도 중복 없이 최신순 유지
export async function recordRecipeView(
  supabase: SupabaseClient<Database>,
  userId: string,
  recipeId: string
) {
  const { error } = await supabase
    .from("recipe_views")
    .upsert(
      { user_id: userId, recipe_id: recipeId, viewed_at: new Date().toISOString() },
      { onConflict: "user_id,recipe_id" }
    );

  if (error) throw error;
}

export async function isRecipeFavorited(
  supabase: SupabaseClient<Database>,
  userId: string,
  recipeId: string
) {
  const { data, error } = await supabase
    .from("user_favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("recipe_id", recipeId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

// F12: 즐겨찾기 추가 (이미 존재하면 그대로 둠)
export async function addFavorite(
  supabase: SupabaseClient<Database>,
  userId: string,
  recipeId: string
) {
  const { error } = await supabase
    .from("user_favorites")
    .upsert({ user_id: userId, recipe_id: recipeId }, { onConflict: "user_id,recipe_id" });

  if (error) {
    if (error.code === "23503") throw new NotFoundError("레시피를 찾을 수 없습니다.");
    throw error;
  }
}

export async function removeFavorite(
  supabase: SupabaseClient<Database>,
  userId: string,
  recipeId: string
) {
  const { error } = await supabase
    .from("user_favorites")
    .delete()
    .eq("user_id", userId)
    .eq("recipe_id", recipeId);

  if (error) throw error;
}

// F11/4.4: 완성 처리 — 기록 남기고, 보유했던 재료를 미보유로 자동 차감하며 소진 이력을 남긴다
export async function completeRecipe(
  supabase: SupabaseClient<Database>,
  userId: string,
  recipeId: string
) {
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes_cache")
    .select("matched_ingredient_ids")
    .eq("id", recipeId)
    .maybeSingle();

  if (recipeError) throw recipeError;
  if (!recipe) throw new NotFoundError("레시피를 찾을 수 없습니다.");

  const { error: completionError } = await supabase
    .from("recipe_completions")
    .insert({ user_id: userId, recipe_id: recipeId });

  if (completionError) throw completionError;

  const requiredIds = recipe.matched_ingredient_ids ?? [];
  if (requiredIds.length === 0) {
    return { consumedIngredientNames: [] as string[] };
  }

  const { data: ownedRows, error: ownedError } = await supabase
    .from("user_fridge")
    .select("id, ingredient_id")
    .eq("user_id", userId)
    .eq("is_owned", true)
    .in("ingredient_id", requiredIds);

  if (ownedError) throw ownedError;
  if (!ownedRows || ownedRows.length === 0) {
    return { consumedIngredientNames: [] as string[] };
  }

  const consumedFridgeIds = ownedRows.map((row) => row.id);
  const { error: updateError } = await supabase
    .from("user_fridge")
    .update({ is_owned: false })
    .in("id", consumedFridgeIds);

  if (updateError) throw updateError;

  const ingredientNameMap = await getIngredientNameMap(supabase);
  const consumedIngredientNames = ownedRows
    .map((row) => (row.ingredient_id ? ingredientNameMap.get(row.ingredient_id) : undefined))
    .filter((name): name is string => Boolean(name));

  if (consumedIngredientNames.length > 0) {
    const { error: logError } = await supabase.from("ingredient_consumption_log").insert(
      consumedIngredientNames.map((ingredientName) => ({
        user_id: userId,
        ingredient_name: ingredientName,
      }))
    );

    if (logError) throw logError;
  }

  return { consumedIngredientNames };
}
