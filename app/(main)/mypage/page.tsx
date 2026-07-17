import { createClient } from "@/lib/supabase/server";
import { requireUserForPage } from "@/lib/utils/require-user";
import { getMypageSummary } from "@/lib/services/mypage-service";
import { LogoutButton } from "@/components/features/LogoutButton";
import { MyPageRecentList } from "@/components/features/MyPageRecentList";
import { MyPageFavoriteList } from "@/components/features/MyPageFavoriteList";
import { MyPageInsightCard } from "@/components/features/MyPageInsightCard";

export default async function MyPage() {
  const supabase = await createClient();
  const user = await requireUserForPage(supabase);
  const summary = await getMypageSummary(supabase, user.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold text-darkGray">마이페이지</h1>

      <div className="rounded-xl border border-border bg-white p-4">
        <p className="text-xs font-medium text-disabledGray">로그인 이메일</p>
        <p className="mt-1 text-base text-darkGray">{user.email}</p>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-darkGray">최근 조회한 요리</h2>
        <MyPageRecentList items={summary.recentViews} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-darkGray">즐겨찾기한 요리</h2>
        <MyPageFavoriteList initialItems={summary.favorites} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold text-darkGray">이번 달 인사이트</h2>
        <MyPageInsightCard
          topCompletedRecipes={summary.topCompletedRecipes}
          topConsumedIngredients={summary.topConsumedIngredients}
          todayCalorieTotal={summary.todayCalorieTotal}
        />
      </section>

      <LogoutButton />
    </div>
  );
}
