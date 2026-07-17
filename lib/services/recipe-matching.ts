export interface MatchingResult {
  isComplete: boolean;
  missingCount: number;
  missingIngredientIds: string[];
}

// CLAUDE.md 4.5절: 매칭 결과는 저장하지 않고 요청마다 계산하는 순수 함수
export function calculateRecipeMatching(
  userOwnedIngredientIds: string[],
  basicSeasoningIds: string[],
  requiredIngredientIds: string[]
): MatchingResult {
  const availableIds = new Set([...userOwnedIngredientIds, ...basicSeasoningIds]);
  const missingIds = requiredIngredientIds.filter((id) => !availableIds.has(id));

  return {
    isComplete: missingIds.length === 0,
    missingCount: missingIds.length,
    missingIngredientIds: missingIds,
  };
}
