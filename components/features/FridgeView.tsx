"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/common/Button";
import { FridgeCategorySection } from "./FridgeCategorySection";
import { IngredientSearchPanel } from "./IngredientSearchPanel";
import type { FridgeItemView } from "./IngredientToggleItem";

const CUSTOM_CATEGORY_LABEL = "직접 추가한 재료";
const STORAGE_LOCATIONS = ["냉장", "냉동", "실온"] as const;
type StorageLocation = (typeof STORAGE_LOCATIONS)[number];

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
  storage_location: StorageLocation;
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
    isBasicSeasoning: row.ingredient?.is_basic_seasoning ?? false,
  };
}

export function FridgeView({
  initialItems,
  showExpiryFields = true,
}: {
  initialItems: FridgeItemRow[];
  showExpiryFields?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StorageLocation>("실온");

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
          entry.type === "master"
            ? { ingredientId: entry.id, storageLocation: activeTab }
            : { customName: entry.name, storageLocation: activeTab }
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
      if (!row.is_owned || row.storage_location !== activeTab) continue;
      const view = toItemView(row);
      if (!map.has(view.category)) map.set(view.category, []);
      map.get(view.category)!.push(view);
    }
    return Array.from(map.entries());
  }, [items, activeTab]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 border-b border-border">
        {STORAGE_LOCATIONS.map((location) => (
          <button
            key={location}
            onClick={() => setActiveTab(location)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === location
                ? "border-b-2 border-primary text-primary"
                : "text-darkGray hover:text-primary"
            }`}
          >
            {location}
          </button>
        ))}
      </div>

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

      {grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white py-16 text-center text-disabledGray">
          {items.length === 0
            ? "아직 등록된 재료가 없어요. 위의 '재료 추가' 버튼으로 등록해보세요."
            : `${activeTab}에 등록된 재료가 없어요.`}
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
            showExpiryFields={showExpiryFields}
          />
        ))
      )}
    </div>
  );
}
