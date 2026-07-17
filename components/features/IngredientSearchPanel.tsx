"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";
import { cn } from "@/lib/utils/cn";

interface SearchResult {
  id: string;
  name: string;
  category: string;
  is_basic_seasoning: boolean;
}

type SelectionEntry =
  | { type: "master"; id: string; name: string }
  | { type: "custom"; name: string };

function selectionKey(entry: SelectionEntry) {
  return entry.type === "master" ? `master:${entry.id}` : `custom:${entry.name}`;
}

// F2/FRONTEND.md 2.1: 검색 결과 다중 선택 후 일괄 confirm, 결과 유무와 무관하게 "직접 추가하기" 상시 노출
export function IngredientSearchPanel({
  existingIngredientIds,
  onConfirm,
}: {
  existingIngredientIds: Set<string>;
  onConfirm: (selected: SelectionEntry[]) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Map<string, SelectionEntry>>(new Map());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/ingredients/search?q=${encodeURIComponent(trimmed)}`);
      const json = await res.json();
      if (json.success) setResults(json.data);
      setSearching(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const trimmedQuery = query.trim();
  const customKey = trimmedQuery ? `custom:${trimmedQuery}` : null;
  const exactNameExists = useMemo(
    () => results.some((result) => result.name === trimmedQuery),
    [results, trimmedQuery]
  );

  function toggleSelection(entry: SelectionEntry) {
    setSelected((prev) => {
      const next = new Map(prev);
      const key = selectionKey(entry);
      if (next.has(key)) next.delete(key);
      else next.set(key, entry);
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      await onConfirm(Array.from(selected.values()));
      setSelected(new Map());
      setQuery("");
      setResults([]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="재료명을 검색하세요 (예: 파)"
        aria-label="재료 검색"
        autoFocus
      />

      <div className="max-h-[280px] overflow-y-auto rounded-lg border border-border">
        {!trimmedQuery && (
          <p className="p-4 text-sm text-disabledGray">검색어를 입력하면 재료를 찾을 수 있어요</p>
        )}

        {trimmedQuery && searching && (
          <p className="p-4 text-sm text-disabledGray">검색 중...</p>
        )}

        {trimmedQuery && !searching && results.length === 0 && (
          <p className="p-4 text-sm text-disabledGray">
            검색 결과가 없어요. 아래에서 직접 추가할 수 있어요.
          </p>
        )}

        {trimmedQuery &&
          !searching &&
          results.map((result) => {
            const alreadyAdded = existingIngredientIds.has(result.id);
            const key = `master:${result.id}`;
            const isSelected = selected.has(key);

            return (
              <button
                key={result.id}
                type="button"
                disabled={alreadyAdded}
                onClick={() => toggleSelection({ type: "master", id: result.id, name: result.name })}
                className={cn(
                  "flex h-11 w-full items-center justify-between px-3 text-left text-base",
                  "hover:bg-lightGray disabled:cursor-not-allowed disabled:text-disabledGray",
                  isSelected && "bg-[#DCE6EC]"
                )}
              >
                <span className="flex items-center gap-2">
                  {isSelected && <span aria-hidden>✓</span>}
                  {result.name}
                </span>
                <span className="text-xs text-disabledGray">
                  {alreadyAdded ? "이미 추가됨" : result.category}
                </span>
              </button>
            );
          })}

        {trimmedQuery && !searching && !exactNameExists && (
          <button
            type="button"
            onClick={() => toggleSelection({ type: "custom", name: trimmedQuery })}
            className={cn(
              "flex h-11 w-full items-center gap-2 border-t border-border px-3 text-left text-base font-medium text-secondary",
              customKey && selected.has(customKey) && "bg-[#DCE6EC]"
            )}
          >
            {customKey && selected.has(customKey) && <span aria-hidden>✓</span>}&quot;{trimmedQuery}
            &quot; 직접 추가하기
          </button>
        )}
      </div>

      <Button
        type="button"
        disabled={selected.size === 0 || submitting}
        onClick={handleConfirm}
        className="w-full"
      >
        {submitting ? "추가하는 중..." : `선택한 재료 추가 (${selected.size})`}
      </Button>
    </div>
  );
}
