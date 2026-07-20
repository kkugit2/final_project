"use client";

import { useEffect, useState } from "react";
import { RecipeFilterBar, type RecipeFilterValue } from "./RecipeFilterBar";
import { RecipeCard, type RecipeCardData } from "./RecipeCard";
import { RecipeDetailModal } from "./RecipeDetailModal";

export function RecipeDashboard() {
  const [filter, setFilter] = useState<RecipeFilterValue>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [items, setItems] = useState<RecipeCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ filter, limit: "60" });
    if (category) params.set("category", category);

    fetch(`/api/recipes/recommend?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setItems(json.data.items);
      })
      .finally(() => setLoading(false));
  }, [filter, category]);

  return (
    <div className="flex flex-col gap-4">
      <RecipeFilterBar
        filter={filter}
        onFilterChange={setFilter}
        category={category}
        onCategoryChange={setCategory}
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-xl bg-lightGray" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white py-16 text-center text-disabledGray">
          조건에 맞는 레시피가 없어요. 재료를 더 등록해보세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onOpenDetail={setSelectedRecipeId}
            />
          ))}
        </div>
      )}

      <RecipeDetailModal
        recipeId={selectedRecipeId || ""}
        isOpen={selectedRecipeId !== null}
        onClose={() => setSelectedRecipeId(null)}
      />
    </div>
  );
}
