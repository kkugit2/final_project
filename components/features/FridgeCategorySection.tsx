"use client";

import { IngredientToggleItem, type FridgeItemView } from "./IngredientToggleItem";

export function FridgeCategorySection({
  category,
  items,
  onToggle,
  onRemove,
  onExpiryChange,
}: {
  category: string;
  items: FridgeItemView[];
  onToggle: (id: string, nextOwned: boolean) => void;
  onRemove: (id: string) => void;
  onExpiryChange: (id: string, expiryDate: string | null) => void;
}) {
  return (
    <section>
      <h2 className="mb-2 rounded-md bg-lightGray px-4 py-3 text-sm font-semibold text-darkGray">
        {category}
      </h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {items.map((item) => (
          <IngredientToggleItem
            key={item.id}
            item={item}
            onToggle={onToggle}
            onRemove={onRemove}
            onExpiryChange={onExpiryChange}
          />
        ))}
      </div>
    </section>
  );
}
