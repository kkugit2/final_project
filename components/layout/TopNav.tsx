"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: "/fridge", label: "나의 냉장고" },
  { href: "/recipes", label: "레시피 추천" },
  { href: "/mypage", label: "마이페이지" },
];

// FRONTEND.md 1장: 데스크톱(1024px 이상)은 상단 네비게이션, 활성 탭은 밑줄로 표시
export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden border-b border-border bg-white lg:flex">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-8 px-8">
        <Link href="/fridge" className="hidden md:flex items-center shrink-0 py-2">
          <Image src="/logo.png" alt="AI 기반 냉장고 재료 레시피 추천" width={160} height={160} priority />
        </Link>
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex h-16 items-center border-b-2 text-sm font-medium",
                isActive ? "border-primary text-primary" : "border-transparent text-disabledGray"
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
