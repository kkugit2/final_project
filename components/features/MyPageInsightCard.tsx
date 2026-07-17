interface TopRecipeEntry {
  recipeId: string;
  name: string;
  count: number;
}

interface TopIngredientEntry {
  ingredientName: string;
  count: number;
}

export function MyPageInsightCard({
  topCompletedRecipes,
  topConsumedIngredients,
  todayCalorieTotal,
}: {
  topCompletedRecipes: TopRecipeEntry[];
  topConsumedIngredients: TopIngredientEntry[];
  todayCalorieTotal: number;
}) {
  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-white p-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-darkGray">가장 자주 만든 요리 TOP 3</h3>
        {topCompletedRecipes.length === 0 ? (
          <p className="text-sm text-disabledGray">아직 완성한 요리가 없어요.</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {topCompletedRecipes.map((entry, index) => (
              <li key={entry.recipeId} className="flex justify-between text-sm text-darkGray">
                <span>
                  {index + 1}. {entry.name}
                </span>
                <span className="text-disabledGray">{entry.count}회</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-darkGray">가장 자주 소진된 재료 TOP 3</h3>
        {topConsumedIngredients.length === 0 ? (
          <p className="text-sm text-disabledGray">아직 소진된 재료가 없어요.</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {topConsumedIngredients.map((entry, index) => (
              <li key={entry.ingredientName} className="flex justify-between text-sm text-darkGray">
                <span>
                  {index + 1}. {entry.ingredientName}
                </span>
                <span className="text-disabledGray">{entry.count}회</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-darkGray">오늘의 섭취 칼로리</h3>
        <p className="text-2xl font-bold text-darkGray">{todayCalorieTotal}kcal</p>
        <p className="mt-1 text-xs text-disabledGray">
          오늘 완성 처리한 요리들의 1인분 기준 칼로리 합산입니다.
        </p>
      </div>
    </div>
  );
}
