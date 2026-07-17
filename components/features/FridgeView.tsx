"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/common/Button";
import { FridgeCategorySection } from "./FridgeCategorySection";
import { IngredientSearchPanel } from "./IngredientSearchPanel";
import type { FridgeItemView } from "./IngredientToggleItem";

const CUSTOM_CATEGORY_LABEL = "직접 추가한 재료";

interface IngredientRef {
  id: string;
  name: string;
  category: string;
  is_basic_seasoning: boolean;
}

interface FridgeItemRow {
  id: string;
  is_owned: boolean;
  expiry_date: string | null;
  updated_at: string;
  custom_name: string | null;
  ingredient: IngredientRef | null;
}

function toItemView(row: FridgeItemRow): FridgeItemView & { category: string } {
  return {
    id: row.id,
    name: row.ingredient?.name ?? row.custom_name ?? "",
    isOwned: row.is_owned,
    expiryDate: row.expiry_date,
    category: row.ingredient?.category ?? CUSTOM_CATEGORY_LABEL,
  };
}

export function FridgeView({ initialItems }: { initialItems: FridgeItemRow[] }) {
  const [items, setItems] = useState(initialItems);
  const [panelOpen, setPanelOpen] = useState(false);

  const existingIngredientIds = useMemo(
    () => new Set(items.map((item) => item.ingredient?.id).filter((id): id is string => Boolean(id))),
    [items]
  );

  async function handleConfirmSelection(
    selected: ({ type: "master"; id: string; name: string } | { type: "custom"; name: string })[]
  ) {
    const added: FridgeItemRow[] = [];

    for (const entry of selected) {
      const res = await fetch("/api/fridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          entry.type === "master" ? { ingredientId: entry.id } : { customName: entry.name }
        ),
      });
      const json = await res.json();
      if (json.success) added.push(json.data);
    }

    if (added.length > 0) {
      setItems((prev) => [...added, ...prev]);
    }
    setPanelOpen(false);
  }

  async function handleToggle(id: string, nextOwned: boolean) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_owned: nextOwned } : item))
    );

    const res = await fetch(`/api/fridge/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOwned: nextOwned }),
    });

    if (!res.ok) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_owned: !nextOwned } : item))
      );
    }
  }

  async function handleRemove(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    await fetch(`/api/fridge/${id}`, { method: "DELETE" });
  }

  async function handleExpiryChange(id: string, expiryDate: string | null) {
    const previous = items.find((item) => item.id === id)?.expiry_date ?? null;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, expiry_date: expiryDate } : item))
    );

    const res = await fetch(`/api/fridge/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiryDate }),
    });

    if (!res.ok) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, expiry_date: previous } : item))
      );
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, (FridgeItemView & { category: string })[]>();
    for (const row of items) {
      const view = toItemView(row);
      if (!map.has(view.category)) map.set(view.category, []);
      map.get(view.category)!.push(view);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setPanelOpen((prev) => !prev)}>
          {panelOpen ? "닫기" : "+ 재료 추가"}
        </Button>
      </div>

      {panelOpen && (
        <IngredientSearchPanel
          existingIngredientIds={existingIngredientIds}
          onConfirm={handleConfirmSelection}
        />
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white py-16 text-center text-disabledGray">
          아직 등록된 재료가 없어요. 위의 &apos;재료 추가&apos; 버튼으로 등록해보세요.
        </div>
      ) : (
        grouped.map(([category, categoryItems]) => (
          <FridgeCategorySection
            key={category}
            category={category}
            items={categoryItems}
            onToggle={handleToggle}
            onRemove={handleRemove}
            onExpiryChange={handleExpiryChange}
          />
        ))
      )}
    </div>
  );
}
