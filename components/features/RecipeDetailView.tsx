"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { IngredientTag } from "@/components/common/IngredientTag";

interface CookingStep {
  step: number;
  text: string;
  imageUrl: string | null;
}

interface RecipeDetail {
  id: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  rawIngredientsText: string;
  cookingSteps: unknown;
  isComplete: boolean;
  missingCount: number;
  ingredients: { id: string; name: string; isOwned: boolean }[];
  isFavorited: boolean;
  nutrition: {
    kcal: number | null;
    carb: number | null;
    protein: number | null;
    fat: number | null;
    sodium: number | null;
  };
}

const NUTRITION_FIELDS: { key: keyof RecipeDetail["nutrition"]; label: string; unit: string }[] = [
  { key: "kcal", label: "칼로리", unit: "kcal" },
  { key: "carb", label: "탄수화물", unit: "g" },
  { key: "protein", label: "단백질", unit: "g" },
  { key: "fat", label: "지방", unit: "g" },
  { key: "sodium", label: "나트륨", unit: "mg" },
];

export function RecipeDetailView({ detail }: { detail: RecipeDetail }) {
  const [isFavorited, setIsFavorited] = useState(detail.isFavorited);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [completeLabel, setCompleteLabel] = useState("이 요리 완성했어요");
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    fetch(`/api/recipes/${detail.id}/view`, { method: "POST" });
  }, [detail.id]);

  async function handleToggleFavorite() {
    setFavoriteLoading(true);
    const nextFavorited = !isFavorited;
    setIsFavorited(nextFavorited);

    const res = await fetch(`/api/recipes/${detail.id}/favorite`, {
      method: nextFavorited ? "POST" : "DELETE",
    });

    if (!res.ok) setIsFavorited(!nextFavorited);
    setFavoriteLoading(false);
  }

  async function handleComplete() {
    setCompleting(true);
    const res = await fetch(`/api/recipes/${detail.id}/complete`, { method: "POST" });

    if (res.ok) {
      setCompleteLabel("완성 기록 저장됨");
      setTimeout(() => setCompleteLabel("이 요리 완성했어요"), 2000);
    }
    setCompleting(false);
  }

  const cookingSteps = (detail.cookingSteps as CookingStep[] | null) ?? [];
  const missingIngredients = detail.ingredients.filter((ingredient) => !ingredient.isOwned);
  const ownedIngredients = detail.ingredients.filter((ingredient) => ingredient.isOwned);
  const hasNutrition = NUTRITION_FIELDS.some((field) => detail.nutrition[field.key] !== null);

  return (
    <article className="flex flex-col gap-6">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-lightGray">
        {detail.imageUrl && (
          <Image src={detail.imageUrl} alt={detail.name} fill className="object-cover" unoptimized />
        )}
      </div>

      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-darkGray">{detail.name}</h1>
          <button
            type="button"
            onClick={handleToggleFavorite}
            disabled={favoriteLoading}
            aria-label={isFavorited ? "즐겨찾기 해제" : "즐겨찾기 추가"}
            aria-pressed={isFavorited}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-xl"
          >
            {isFavorited ? "♥" : "♡"}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant={detail.isComplete ? "complete" : "partial"}>
            {detail.isComplete ? "완전 보유" : `부족 재료 ${detail.missingCount}개`}
          </Badge>
          {detail.category && <Badge variant="tag">{detail.category}</Badge>}
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-darkGray">보유 재료</h2>
        {ownedIngredients.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {ownedIngredients.map((ingredient) => (
              <li key={ingredient.id}>
                <IngredientTag name={ingredient.name} isOwned />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-disabledGray">보유한 재료가 없어요.</p>
        )}

        {missingIngredients.length > 0 && (
          <>
            <h2 className="mb-2 mt-4 text-lg font-semibold text-darkGray">부족 재료</h2>
            <ul className="flex flex-wrap gap-2">
              {missingIngredients.map((ingredient) => (
                <li key={ingredient.id}>
                  <IngredientTag name={ingredient.name} isOwned={false} />
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-3 whitespace-pre-line text-sm text-disabledGray">
          {detail.rawIngredientsText}
        </p>
      </section>

      {hasNutrition && (
        <section>
          <h2 className="mb-2 text-lg font-semibold text-darkGray">영양 정보 (1인분 기준)</h2>
          <p className="mb-2 text-xs text-disabledGray">
            참고용 정보이며 전문가 상담을 대체하지 않습니다.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {NUTRITION_FIELDS.map((field) => {
              const value = detail.nutrition[field.key];
              if (value === null) return null;
              return (
                <div key={field.key} className="rounded-lg border border-border bg-white p-3 text-center">
                  <p className="text-xs text-disabledGray">{field.label}</p>
                  <p className="mt-1 text-base font-semibold text-darkGray">
                    {value}
                    {field.unit}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold text-darkGray">조리 순서</h2>
        <ol className="flex flex-col gap-4">
          {cookingSteps.map((step) => (
            <li key={step.step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                {step.step}
              </span>
              <div>
                <p className="text-base text-darkGray">{step.text}</p>
                {step.imageUrl && (
                  <div className="relative mt-2 aspect-video w-full max-w-sm overflow-hidden rounded-lg bg-lightGray">
                    <Image
                      src={step.imageUrl}
                      alt={`조리 순서 ${step.step}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Button type="button" onClick={handleComplete} disabled={completing} className="w-full">
        {completeLabel}
      </Button>
    </article>
  );
}
