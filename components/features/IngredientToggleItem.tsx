"use client";

import { useState } from "react";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { Toggle } from "@/components/common/Toggle";
import { Badge } from "@/components/common/Badge";

const EXPIRY_WARNING_DAYS = 3;

function getDaysUntil(dateString: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export interface FridgeItemView {
  id: string;
  name: string;
  isOwned: boolean;
  expiryDate: string | null;
  category?: string;
  isBasicSeasoning?: boolean;
}

export function IngredientToggleItem({
  item,
  onToggle,
  onRemove,
  onExpiryChange,
  showExpiryField = true,
}: {
  item: FridgeItemView;
  onToggle: (id: string, nextOwned: boolean) => void;
  onRemove: (id: string) => void;
  onExpiryChange: (id: string, expiryDate: string | null) => void;
  showExpiryField?: boolean;
}) {
  const [editingExpiry, setEditingExpiry] = useState(false);
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const isSeasoning = item.category === "조미료";
  const shouldShowExpiry = showExpiryField && !isSeasoning;
  const daysUntilExpiry = item.expiryDate ? getDaysUntil(item.expiryDate) : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= EXPIRY_WARNING_DAYS;

  // 모바일: 세로 레이아웃 (모든 식재료)
  if (isMobile) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border bg-white px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Toggle
              checked={item.isOwned}
              onChange={(checked) => onToggle(item.id, checked)}
              label={`${item.name} 보유 여부`}
            />
            <span className={`truncate text-sm font-medium ${isExpiringSoon ? "font-bold text-darkGray" : "text-darkGray"}`}>
              {item.name}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`${item.name} 삭제`}
            className="shrink-0 text-disabledGray hover:text-error"
          >
            ×
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-8">
          {item.isBasicSeasoning && (
            <Badge variant="tag" className="bg-blue-100 text-primary">
              기본 조미료
            </Badge>
          )}

          {shouldShowExpiry && (
            <>
              {editingExpiry ? (
                <input
                  type="date"
                  defaultValue={item.expiryDate ?? ""}
                  autoFocus
                  onBlur={(event) => {
                    onExpiryChange(item.id, event.target.value || null);
                    setEditingExpiry(false);
                  }}
                  className="h-6 rounded border border-border px-1 text-xs"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingExpiry(true)}
                  aria-label={`${item.name} 유통기한 수정`}
                >
                  {daysUntilExpiry !== null ? (
                    <Badge variant={isExpiringSoon ? "partial" : "tag"}>
                      {daysUntilExpiry < 0
                        ? "유통기한 지남"
                        : daysUntilExpiry === 0
                          ? "오늘까지"
                          : `D-${daysUntilExpiry}`}
                    </Badge>
                  ) : (
                    <Badge variant="tag">유통기한 입력</Badge>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // 웹 환경: 가로 레이아웃
  return (
    <div className="flex h-11 items-center justify-between gap-2 rounded-md border border-border bg-white px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Toggle
          checked={item.isOwned}
          onChange={(checked) => onToggle(item.id, checked)}
          label={`${item.name} 보유 여부`}
        />
        <span className={`truncate text-sm ${isExpiringSoon ? "font-bold text-darkGray" : ""}`}>
          {item.name}
        </span>

        {item.isBasicSeasoning && (
          <Badge variant="tag" className="bg-blue-100 text-primary">
            기본 조미료
          </Badge>
        )}

        {shouldShowExpiry && (
          <>
            {editingExpiry ? (
              <input
                type="date"
                defaultValue={item.expiryDate ?? ""}
                autoFocus
                onBlur={(event) => {
                  onExpiryChange(item.id, event.target.value || null);
                  setEditingExpiry(false);
                }}
                className="h-6 shrink-0 rounded border border-border px-1 text-xs"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingExpiry(true)}
                aria-label={`${item.name} 유통기한 수정`}
                className="shrink-0"
              >
                {daysUntilExpiry !== null ? (
                  <Badge variant={isExpiringSoon ? "partial" : "tag"}>
                    {daysUntilExpiry < 0
                      ? "유통기한 지남"
                      : daysUntilExpiry === 0
                        ? "오늘까지"
                        : `D-${daysUntilExpiry}`}
                  </Badge>
                ) : (
                  <Badge variant="tag">유통기한 입력</Badge>
                )}
              </button>
            )}
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label={`${item.name} 삭제`}
        className="shrink-0 text-disabledGray hover:text-error"
      >
        ×
      </button>
    </div>
  );
}
