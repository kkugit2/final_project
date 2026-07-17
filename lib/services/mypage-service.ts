import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const RECENT_VIEWS_LIMIT = 5;
const INSIGHT_TOP_N = 3;
// 별도 집계 테이블 없이 조회 시점에 계산(PRD_.md 6.2절) — 그룹핑 대상 최근 이력 상한
const STATS_LOOKBACK_LIMIT = 500;

function startOfTodayIso() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function topNByCount<T>(rows: T[], keyOf: (row: T) => string, limit: number) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

// F13: 최근 조회한 요리 (최신순 5개)
async function getRecentViews(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("recipe_views")
    .select("viewed_at, recipe:recipes_cache(id, name, image_url)")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(RECENT_VIEWS_LIMIT);

  if (error) throw error;
  return (data ?? [])
    .filter((row) => row.recipe)
    .map((row) => ({ viewedAt: row.viewed_at, recipe: row.recipe! }));
}

// F12: 즐겨찾기한 요리 전체
async function getFavorites(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("user_favorites")
    .select("created_at, recipe:recipes_cache(id, name, image_url)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? [])
    .filter((row) => row.recipe)
    .map((row) => ({ createdAt: row.created_at, recipe: row.recipe! }));
}

// F14: 자주 만든 요리 TOP 3
async function getTopCompletedRecipes(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("recipe_completions")
    .select("recipe_id")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(STATS_LOOKBACK_LIMIT);

  if (error) throw error;

  const top = topNByCount(data ?? [], (row) => row.recipe_id, INSIGHT_TOP_N);
  if (top.length === 0) return [];

  const { data: recipes, error: recipesError } = await supabase
    .from("recipes_cache")
    .select("id, name")
    .in(
      "id",
      top.map((entry) => entry.key)
    );

  if (recipesError) throw recipesError;
  const nameMap = new Map((recipes ?? []).map((recipe) => [recipe.id, recipe.name]));

  return top.map((entry) => ({
    recipeId: entry.key,
    name: nameMap.get(entry.key) ?? "",
    count: entry.count,
  }));
}

// F14: 자주 소진된 재료 TOP 3
async function getTopConsumedIngredients(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("ingredient_consumption_log")
    .select("ingredient_name")
    .eq("user_id", userId)
    .order("consumed_at", { ascending: false })
    .limit(STATS_LOOKBACK_LIMIT);

  if (error) throw error;

  const top = topNByCount(data ?? [], (row) => row.ingredient_name, INSIGHT_TOP_N);
  return top.map((entry) => ({ ingredientName: entry.key, count: entry.count }));
}

// F16: 오늘 완성한 요리들의 칼로리 합산
async function getTodayCalorieTotal(supabase: SupabaseClient<Database>, userId: string) {
  const { data: completions, error } = await supabase
    .from("recipe_completions")
    .select("recipe_id")
    .eq("user_id", userId)
    .gte("completed_at", startOfTodayIso());

  if (error) throw error;
  if (!completions || completions.length === 0) return 0;

  const { data: recipes, error: recipesError } = await supabase
    .from("recipes_cache")
    .select("id, nutrition_kcal")
    .in(
      "id",
      completions.map((row) => row.recipe_id)
    );

  if (recipesError) throw recipesError;

  const kcalMap = new Map((recipes ?? []).map((recipe) => [recipe.id, recipe.nutrition_kcal]));
  return completions.reduce((sum, row) => sum + (kcalMap.get(row.recipe_id) ?? 0), 0);
}

export async function getMypageSummary(supabase: SupabaseClient<Database>, userId: string) {
  const [recentViews, favorites, topCompletedRecipes, topConsumedIngredients, todayCalorieTotal] =
    await Promise.all([
      getRecentViews(supabase, userId),
      getFavorites(supabase, userId),
      getTopCompletedRecipes(supabase, userId),
      getTopConsumedIngredients(supabase, userId),
      getTodayCalorieTotal(supabase, userId),
    ]);

  return {
    recentViews,
    favorites,
    topCompletedRecipes,
    topConsumedIngredients,
    todayCalorieTotal,
  };
}
