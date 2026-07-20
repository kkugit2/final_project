"use client";

import Image from "next/image";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";

export interface RecipeCardData {
  id: string;
  name: string;
  category: string | null;
  imageUrl: string | null;
  isComplete: boolean;
  missingCount: number;
  missingIngredientNames: string[];
}

export function RecipeCard({
  recipe,
  onOpenDetail,
}: {
  recipe: RecipeCardData;
  onOpenDetail: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onOpenDetail(recipe.id)}
      className="w-full text-left"
    >
      <Card className="flex h-full flex-col overflow-hidden hover:shadow-lg transition-shadow">
        <div className="relative aspect-video w-full bg-lightGray">
          {recipe.imageUrl && (
            <Image
              src={recipe.imageUrl}
              alt={`${recipe.name} (${recipe.isComplete ? "완전 매칭 가능" : "일부 재료 부족"})`}
              fill
              className="object-cover"
              unoptimized
            />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="text-lg font-semibold text-darkGray">{recipe.name}</h3>
          <Badge variant={recipe.isComplete ? "complete" : "partial"}>
            {recipe.isComplete ? "완전 보유" : `부족 재료 ${recipe.missingCount}개`}
          </Badge>
          {!recipe.isComplete && recipe.missingIngredientNames.length > 0 && (
            <p className="text-sm text-disabledGray">
              부족 재료: {recipe.missingIngredientNames.join(", ")}
            </p>
          )}
        </div>
      </Card>
    </button>
  );
}
