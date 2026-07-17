import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { calculateRecipeMatching } from "./recipe-matching";
import { getBasicSeasoningIds, getIngredientNameMap } from "./ingredient-service";
import { isRecipeFavorited } from "./recipe-interaction-service";
import { NotFoundError } from "@/lib/utils/errors";

async function getOwnedIngredientIds(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("user_fridge")
    .select("ingredient_id")
    .eq("user_id", userId)
    .eq("is_owned", true);

  if (error) throw error;
  return (data ?? [])
    .map((row) => row.ingredient_id)
    .filter((id): id is string => Boolean(id));
}

export interface RecommendParams {
  userId: string;
  filter: "complete" | "partial" | "all";
  category?: string;
  limit: number;
  offset: number;
}

export async function getRecommendedRecipes(
  supabase: SupabaseClient<Database>,
  params: RecommendParams
) {
  const [ownedIds, basicSeasoningIds, ingredientNameMap] = await Promise.all([
    getOwnedIngredientIds(supabase, params.userId),
    getBasicSeasoningIds(supabase),
    getIngredientNameMap(supabase),
  ]);

  let query = supabase
    .from("recipes_cache")
    .select("id, name, category, image_url, matched_ingredient_ids");

  if (params.category) query = query.eq("category", params.category);

  const { data, error } = await query;
  if (error) throw error;

  const matched = (data ?? []).map((recipe) => {
    const result = calculateRecipeMatching(
      ownedIds,
      basicSeasoningIds,
      recipe.matched_ingredient_ids ?? []
    );

    return {
      id: recipe.id,
      name: recipe.name,
      category: recipe.category,
      imageUrl: recipe.image_url,
      isComplete: result.isComplete,
      missingCount: result.missingCount,
      missingIngredientNames: result.missingIngredientIds
        .map((id) => ingredientNameMap.get(id))
        .filter((name): name is string => Boolean(name)),
    };
  });

  const filtered = matched.filter((recipe) => {
    if (params.filter === "complete") return recipe.isComplete;
    if (params.filter === "partial") return !recipe.isComplete;
    return true;
  });

  filtered.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1;
    return a.missingCount - b.missingCount;
  });

  const total = filtered.length;
  const items = filtered.slice(params.offset, params.offset + params.limit);

  return { items, total };
}

export async function getRecipeDetail(
  supabase: SupabaseClient<Database>,
  userId: string,
  recipeId: string
) {
  const [ownedIds, basicSeasoningIds, ingredientNameMap, isFavorited] = await Promise.all([
    getOwnedIngredientIds(supabase, userId),
    getBasicSeasoningIds(supabase),
    getIngredientNameMap(supabase),
    isRecipeFavorited(supabase, userId, recipeId),
  ]);

  const { data: recipe, error } = await supabase
    .from("recipes_cache")
    .select("*")
    .eq("id", recipeId)
    .maybeSingle();

  if (error) throw error;
  if (!recipe) throw new NotFoundError("레시피를 찾을 수 없습니다.");

  const result = calculateRecipeMatching(
    ownedIds,
    basicSeasoningIds,
    recipe.matched_ingredient_ids ?? []
  );
  const ownedSet = new Set([...ownedIds, ...basicSeasoningIds]);

  const ingredients = (recipe.matched_ingredient_ids ?? []).map((id) => ({
    id,
    name: ingredientNameMap.get(id) ?? "",
    isOwned: ownedSet.has(id),
  }));

  return {
    id: recipe.id,
    name: recipe.name,
    category: recipe.category,
    imageUrl: recipe.image_url,
    rawIngredientsText: recipe.raw_ingredients_text,
    parsedIngredients: recipe.parsed_ingredients,
    cookingSteps: recipe.cooking_steps,
    isComplete: result.isComplete,
    missingCount: result.missingCount,
    ingredients,
    isFavorited,
    nutrition: {
      kcal: recipe.nutrition_kcal,
      carb: recipe.nutrition_carb,
      protein: recipe.nutrition_protein,
      fat: recipe.nutrition_fat,
      sodium: recipe.nutrition_sodium,
    },
  };
}
