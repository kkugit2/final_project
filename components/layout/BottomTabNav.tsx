"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: "/fridge", label: "나의 냉장고" },
  { href: "/recipes", label: "레시피 추천" },
  { href: "/mypage", label: "마이페이지" },
];

// FRONTEND.md 1장: 모바일(320~767px)은 하단 탭(높이 56px)로 고정 노출, 1024px부터는 TopNav로 전환
export function BottomTabNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex h-14 border-t border-border bg-white lg:hidden">
      <div className="mx-auto flex w-full max-w-[1200px] justify-around">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center text-xs font-medium",
                isActive ? "text-primary" : "text-disabledGray"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
