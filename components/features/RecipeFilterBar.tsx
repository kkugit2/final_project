"use client";

import { cn } from "@/lib/utils/cn";

export type RecipeFilterValue = "all" | "complete" | "partial";

// food_recipes_data_fin.csv의 RCP_PAT2 실제 값 (한식 카테고리 대분류)
const CATEGORIES = ["반찬", "국&찌개", "후식", "일품", "밥", "기타"];

const FILTERS: { value: RecipeFilterValue; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "complete", label: "완전 보유" },
  { value: "partial", label: "일부 부족" },
];

export function RecipeFilterBar({
  filter,
  onFilterChange,
  category,
  onCategoryChange,
}: {
  filter: RecipeFilterValue;
  onFilterChange: (value: RecipeFilterValue) => void;
  category: string | null;
  onCategoryChange: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-[#F9FAFB] p-4">
      <div className="flex gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onFilterChange(option.value)}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-medium transition-colors duration-200",
              filter === option.value
                ? "bg-primary text-white"
                : "border border-border bg-white text-darkGray"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onCategoryChange(null)}
          className={cn(
            "h-8 rounded-full px-3 text-xs font-medium",
            category === null
              ? "bg-secondary text-white"
              : "border border-border bg-white text-disabledGray"
          )}
        >
          전체 요리
        </button>
        {CATEGORIES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onCategoryChange(value)}
            className={cn(
              "h-8 rounded-full px-3 text-xs font-medium",
              category === value
                ? "bg-secondary text-white"
                : "border border-border bg-white text-disabledGray"
            )}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}
