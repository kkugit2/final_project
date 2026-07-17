"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

interface FavoriteEntry {
  createdAt: string;
  recipe: { id: string; name: string; image_url: string | null };
}

export function MyPageFavoriteList({ initialItems }: { initialItems: FavoriteEntry[] }) {
  const [items, setItems] = useState(initialItems);

  async function handleUnfavorite(recipeId: string) {
    setItems((prev) => prev.filter((entry) => entry.recipe.id !== recipeId));
    await fetch(`/api/recipes/${recipeId}/favorite`, { method: "DELETE" });
  }

  if (items.length === 0) {
    return <p className="text-sm text-disabledGray">아직 즐겨찾기한 요리가 없어요.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map(({ recipe }) => (
        <li
          key={recipe.id}
          className="flex items-center gap-3 rounded-lg border border-border bg-white p-2"
        >
          <Link href={`/recipes/${recipe.id}`} className="flex flex-1 items-center gap-3 min-w-0">
            <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-lightGray">
              {recipe.image_url && (
                <Image
                  src={recipe.image_url}
                  alt={recipe.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              )}
            </div>
            <span className="truncate text-sm text-darkGray">{recipe.name}</span>
          </Link>
          <button
            type="button"
            onClick={() => handleUnfavorite(recipe.id)}
            aria-label={`${recipe.name} 즐겨찾기 해제`}
            className="shrink-0 text-xl text-primary"
          >
            ♥
          </button>
        </li>
      ))}
    </ul>
  );
}
