import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border border-border px-3 text-base placeholder:text-disabledGray",
        "focus:border-2 focus:border-secondary focus:bg-[#F0F9FF] focus:outline-none",
        className
      )}
      {...props}
    />
  );
}
