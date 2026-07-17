import { TopNav } from "@/components/layout/TopNav";
import { BottomTabNav } from "@/components/layout/BottomTabNav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col pb-14 lg:pb-0">
      <TopNav />
      <BottomTabNav />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
