// 식약처 CSV의 RCP_PARTS(AE열)는 RCP_PARTS_DTLS(원본 비정형 텍스트)와 달리
// 수량/단위 없이 이미 정리된 재료명이 쉼표로 구분되어 있어, 콤마 분리만으로 충분하다.
export function parsePartsColumn(rawText: string): string[] {
  return rawText
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export interface IngredientMatchCandidate {
  id: string;
  name: string;
  synonyms: string[];
}

// CLAUDE.md 6장 4~5단계: 매칭에 영향을 주지 않는 조리 상태/손질 방식 수식어를 제거해
// "다진 마늘", "마늘다진것", "삶은 감자" 등이 모두 같은 재료로 인식되게 한다.
const PREFIX_MODIFIERS = [
  "잘게다진",
  "곱게다진",
  "다져놓은",
  "어슷썬",
  "채썬",
  "슬라이스",
  "으깬",
  "다진",
  "삶은",
  "구운",
  "볶은",
  "튀긴",
  "건조",
  "냉동",
  "손질된",
  "다듬은",
];

const SUFFIX_MODIFIERS = ["다진것", "마른것", "간것", "썬것", "빻은것", "으깬것", "통조림"];

function stripModifiers(compactName: string): string {
  let result = compactName;

  for (const suffix of SUFFIX_MODIFIERS) {
    if (result.length > suffix.length && result.endsWith(suffix)) {
      result = result.slice(0, -suffix.length);
      break;
    }
  }

  for (const prefix of PREFIX_MODIFIERS) {
    if (result.length > prefix.length && result.startsWith(prefix)) {
      result = result.slice(prefix.length);
      break;
    }
  }

  return result;
}

// 재료명 배열을 ingredients_master 후보와 대조해 매칭된 id 목록을 반환한다.
//
// 반드시 "정확히 일치"하는 경우에만 매칭한다. 과거에는 haystack.includes(term)로
// 부분 문자열 매칭을 했는데, "대파"의 동의어 "파" 때문에 "파프리카"/"파슬리가루"/
// "파인애플"이 전부 대파로 오매칭되는 등 실제 서비스에서 확인된 버그가 있었다.
// 수식어(다진/삶은 등)는 위에서 먼저 제거하므로, 그 이후엔 완전 일치만 허용해도
// "다진 마늘" 같은 변형은 정상적으로 잡힌다.
export function matchIngredientIds(
  parsedNames: string[],
  candidates: IngredientMatchCandidate[]
): string[] {
  const matchedIds = new Set<string>();

  for (const rawName of parsedNames) {
    const compact = rawName.replace(/\s+/g, "");
    if (!compact) continue;

    const normalized = stripModifiers(compact);

    for (const candidate of candidates) {
      const terms = [candidate.name, ...candidate.synonyms]
        .map((term) => term.replace(/\s+/g, ""))
        .filter(Boolean);

      if (terms.some((term) => term === compact || term === normalized)) {
        matchedIds.add(candidate.id);
        break;
      }
    }
  }

  return Array.from(matchedIds);
}
