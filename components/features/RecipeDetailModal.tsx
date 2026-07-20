"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { RecipeDetailView } from "./RecipeDetailView";

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

interface RecipeDetailModalProps {
  recipeId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function RecipeDetailModal({
  recipeId,
  isOpen,
  onClose,
}: RecipeDetailModalProps) {
  const [detail, setDetail] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    fetch(`/api/recipes/${recipeId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setDetail(json.data);
      })
      .finally(() => setLoading(false));
  }, [recipeId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSheetDragStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart(clientY);
  }, []);

  const handleDragMove = useCallback(
    (clientY: number) => {
      if (!isDragging || !isMobile) return;

      const diff = clientY - dragStart;

      // 아래로 50px 이상 드래그 → 시트 닫기
      if (diff > 50 && !isExpanded) {
        onClose();
        setIsDragging(false);
      }
      // 위로 100px 이상 드래그 → 전체 화면 확대
      else if (diff < -100 && !isExpanded) {
        setIsExpanded(true);
        setIsDragging(false);
      }
    },
    [isDragging, dragStart, isMobile, isExpanded, onClose]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      handleDragMove(e.touches[0].clientY);
    },
    [handleDragMove]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      handleDragMove(e.clientY);
    },
    [handleDragMove]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleDragEnd);
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleDragEnd);
      return () => {
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleDragEnd);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleDragEnd);
      };
    }
  }, [isDragging, handleTouchMove, handleMouseMove, handleDragEnd]);

  if (!isOpen) return null;

  // 웹 환경: 모달
  if (!isMobile) {
    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <div
          className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 sm:p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-xl hover:bg-lightGray"
            aria-label="닫기"
          >
            ×
          </button>

          {loading ? (
            <div className="flex h-96 items-center justify-center">
              <div className="text-center">
                <div className="mb-2 h-8 w-48 animate-pulse rounded bg-lightGray" />
                <div className="h-4 w-full animate-pulse rounded bg-lightGray" />
              </div>
            </div>
          ) : detail ? (
            <RecipeDetailView detail={detail} />
          ) : (
            <div className="flex h-96 items-center justify-center text-center text-disabledGray">
              레시피를 불러올 수 없습니다.
            </div>
          )}
        </div>
      </div>
    );
  }

  // 모바일 환경: Bottom Sheet
  return (
    <div className="fixed inset-0 z-40 lg:z-50">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-300"
        onClick={onClose}
        style={{
          opacity: isExpanded ? 1 : 0.3,
        }}
      />

      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 flex flex-col rounded-t-3xl bg-white transition-all duration-300"
        style={{
          height: isExpanded ? "100vh" : "70vh",
          maxHeight: "100vh",
        }}
      >
        {/* Handle Bar */}
        <div
          className="flex cursor-grab items-center justify-center border-b border-border bg-white py-3 active:cursor-grabbing select-none"
          onMouseDown={handleSheetDragStart}
          onTouchStart={handleSheetDragStart}
        >
          <div className="h-1 w-12 rounded-full bg-disabledGray" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-96 items-center justify-center">
              <div className="text-center">
                <div className="mb-2 h-8 w-48 animate-pulse rounded bg-lightGray" />
                <div className="h-4 w-full animate-pulse rounded bg-lightGray" />
              </div>
            </div>
          ) : detail ? (
            <div className="p-6 sm:p-8">
              <RecipeDetailView detail={detail} />
            </div>
          ) : (
            <div className="flex h-96 items-center justify-center text-center text-disabledGray">
              레시피를 불러올 수 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
