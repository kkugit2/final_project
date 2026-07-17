import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // UI-UX 가이드: Steel Blue 단일 액센트 + 아이스 그레이 뉴트럴.
        // 상태 구분은 새 색상을 추가하는 대신 톤 농도/채움-윤곽선으로 표현한다.
        primary: {
          DEFAULT: "#4A7C9E",
          hover: "#3B6480",
        },
        secondary: "#7FA8C2",
        accent: "#2F5772",
        success: "#059669",
        warning: "#D97706",
        error: "#DC2626",
        info: "#0284C7",
        darkGray: "#1F2937",
        lightGray: "#EEF3F6",
        disabledGray: "#94A3AE",
        border: "#DDE6EC",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "Segoe UI", "sans-serif"],
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
