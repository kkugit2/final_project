import Link from "next/link";
import Image from "next/image";

interface RecentViewEntry {
  viewedAt: string;
  recipe: { id: string; name: string; image_url: string | null };
}

export function MyPageRecentList({ items }: { items: RecentViewEntry[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-disabledGray">아직 조회한 요리가 없어요.</p>;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {items.map(({ recipe }) => (
        <Link
          key={recipe.id}
          href={`/recipes/${recipe.id}`}
          className="flex w-32 shrink-0 flex-col gap-2"
        >
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-lightGray">
            {recipe.image_url && (
              <Image src={recipe.image_url} alt={recipe.name} fill className="object-cover" unoptimized />
            )}
          </div>
          <p className="truncate text-sm text-darkGray">{recipe.name}</p>
        </Link>
      ))}
    </div>
  );
}
