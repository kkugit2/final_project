import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type BadgeVariant = "complete" | "partial" | "tag";

// 상태 구분은 색상이 아니라 채움(완전 매칭) vs 윤곽선(일부 부족)으로 표현 (Steel Blue 단일 계열 유지)
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  complete: "bg-primary text-white",
  partial: "border border-primary text-primary bg-white",
  tag: "bg-lightGray text-darkGray",
};

export function Badge({
  variant,
  children,
  className,
}: {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded px-2 py-1 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
