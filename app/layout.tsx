import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "냉장고 재료 레시피 추천",
  description: "보유한 식재료로 지금 바로 만들 수 있는 요리를 추천받는 서비스",
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/manifest.json",
  themeColor: "#1a5b8d",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "있조",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="있조" />
      </head>
      <body className="bg-lightGray text-darkGray antialiased">
        {children}
        <Script
          id="pwa-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {
                    // Service Worker 등록 실패는 무시
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
