import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "냉장고 재료 레시피 추천",
  description: "보유한 식재료로 지금 바로 만들 수 있는 요리를 추천받는 서비스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-lightGray text-darkGray antialiased">{children}</body>
    </html>
  );
}
