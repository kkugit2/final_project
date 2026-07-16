# CLAUDE.md — 냉장고 재료 기반 레시피 추천 서비스

개발자(Claude Code)가 이 프로젝트의 코드를 작성할 때 따라야 할 규칙과 원칙을 정의합니다.  
기반 문서: `PRD.md` (v1.0), `UI-UX-Guideline.md` (v1.0), `Backend-Guideline.md` (v1.0)

---

## 1. 프로젝트 개요

**서비스**: 1인 가구 직장인이 보유한 식재료로 만들 수 있는 요리를 추천받는 웹/모바일 서비스

**MVP 범위 (P0)**: 회원가입/로그인 → 식재료 등록 → 나의 냉장고 → 레시피 추천 대시보드 → 레시피 상세 조회

**기술 스택**:
- **프론트엔드/백엔드**: Next.js (App Router, 풀스택)
- **인증**: Supabase Auth (이메일 기반)
- **DB**: Supabase (PostgreSQL)
- **레시피 데이터**: CSV 파일 (food_recipes_data.csv, 1,146개 레시피)
- **배포**: Vercel
- **언어**: TypeScript (strict mode) + Zod (검증)

---

## 2. 코드 컨벤션

### 파일명 및 네이밍
- 파일명: `kebab-case.ts` (예: `recipe-matching.ts`, `api-response.ts`)
- 함수/변수: `camelCase`
- 타입/인터페이스: `PascalCase`
- 상수: `UPPER_SNAKE_CASE`

### 폴더 구조 (반드시 준수)
```
app/
  api/
    ingredients/search/route.ts        # GET: 식재료 검색
    fridge/
      route.ts                         # GET: 목록, POST: 추가
      [id]/route.ts                    # PATCH: 토글, DELETE: 삭제
    recipes/
      recommend/route.ts               # GET: 추천 목록
      [id]/route.ts                    # GET: 상세 조회
lib/
  supabase/
    server.ts                          # 서버용 Supabase 클라이언트
    client.ts                          # 브라우저용 Supabase 클라이언트
  services/
    ingredient-service.ts              # ingredients_master 검색
    fridge-service.ts                  # user_fridge CRUD
    recipe-service.ts                  # recipes_cache 조회
    recipe-matching.ts                 # 보유-레시피 매칭 계산 (순수 함수)
    csv-recipe-loader.ts               # CSV 파일에서 recipes_cache로 로드
  validators/
    fridge.schema.ts
    recipe.schema.ts
  utils/
    api-response.ts                    # { success, data/error } 포맷
    errors.ts                          # 커스텀 에러 클래스
types/
  database.types.ts                    # Supabase CLI 자동 생성 (수동 수정 금지)
scripts/
  load-recipes-from-csv.ts             # CSV 파일에서 recipes_cache로 로드 (초기화 시 1회)
```

---

## 3. 아키텍처 원칙

### 계층 분리
```
[클라이언트 컴포넌트 (React)]
         ↓
[Route Handler / Server Action]
    (검증 → 인증 → 인가)
         ↓
[서비스 계층 (lib/services/)]
    (비즈니스 로직 + DB/외부 API)
         ↓
[Supabase / 외부 API]
```

**핵심 원칙**:
- Route Handler는 **입력 검증 → 세션 확인 → 서비스 호출 → 응답 변환**만 담당
- 복잡한 로직은 `lib/services/`로 분리
- **클라이언트 컴포넌트에서 Supabase에 직접 쓰기 작업 금지** (Server Action 또는 Route Handler 사용)

### 데이터베이스 쓰기 권한
- `user_fridge`: RLS 활성화, `user_id = auth.uid()` 정책 (사용자는 자신의 데이터만 수정)
- `ingredients_master`, `recipes_cache`: 쓰기는 `service_role`만 (배치 스크립트)

---

## 4. 주요 개발 원칙

### 4.1 요청 입력 검증
**모든** Route Handler/Server Action에서 Zod 스키마로 검증:

```ts
// lib/validators/fridge.schema.ts
import { z } from "zod";

export const addIngredientSchema = z.object({
  ingredientId: z.string().uuid("Invalid ingredient ID"),
});

// app/api/fridge/route.ts
import { addIngredientSchema } from "@/lib/validators/fridge.schema";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = addIngredientSchema.parse(body); // 검증 통과 또는 throw
  // ...
}
```

### 4.2 표준 응답 포맷
**모든 API 응답**은 아래 형식을 따름:

```ts
// 성공
{ success: true, data: { /* 페이로드 */ } }

// 실패
{ success: false, error: { code: "USER_NOT_FOUND", message: "사용자가 없습니다." } }
```

상태 코드:
- `200`: 조회/성공
- `201`: 생성 성공
- `400`: 검증 실패
- `401`: 미인증
- `403`: 권한 없음 (다른 사용자 데이터 접근 시도)
- `404`: 리소스 없음
- `500`: 서버 오류

### 4.3 에러 처리
예상 가능한 에러는 커스텀 클래스로 throw:

```ts
// lib/utils/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}

// Route Handler에서
try {
  // ...
} catch (error) {
  if (error instanceof AppError) {
    return Response.json(fail(error.code, error.message), {
      status: error.statusCode,
    });
  }
  // 예상치 못한 에러는 로그 후 일반화된 메시지만 반환
  console.error(error);
  return Response.json(fail("INTERNAL_ERROR", "서버 오류 발생"), {
    status: 500,
  });
}
```

### 4.4 인증/인가
모든 사용자 데이터 접근 API는:

1. **세션 확인**: `auth.uid()` 또는 401 에러
2. **소유자 확인**: 요청 대상 레코드의 `user_id`와 현재 사용자 비교, 미일치 시 403 에러

```ts
// app/api/fridge/[id]/route.ts
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  // 1. 세션 확인
  const { data: session } = await supabase.auth.getSession();
  if (!session?.user) {
    return Response.json(fail("UNAUTHORIZED", "로그인이 필요합니다."), {
      status: 401,
    });
  }

  // 2. 소유자 확인
  const { data: fridgeItem } = await supabase
    .from("user_fridge")
    .select("user_id")
    .eq("id", params.id)
    .single();

  if (!fridgeItem || fridgeItem.user_id !== session.user.id) {
    return Response.json(fail("FORBIDDEN", "권한이 없습니다."), {
      status: 403,
    });
  }

  // 3. 비즈니스 로직
  // ...
}
```

### 4.5 레시피 매칭 로직
**핵심**: 매칭 결과는 DB에 저장하지 않고 **매 요청마다 계산**

```ts
// lib/services/recipe-matching.ts (순수 함수)
export function calculateRecipeMatching(
  userOwnedIngredientIds: string[], // user_fridge에서 is_owned=true인 ID들
  basicSeasoningIds: string[],       // ingredients_master에서 is_basic_seasoning=true인 ID들
  recipe: RecipeCache              // recipes_cache 레코드
): MatchingResult {
  const availableIds = new Set([...userOwnedIngredientIds, ...basicSeasoningIds]);
  const requiredIds = new Set(recipe.matched_ingredient_ids); // 레시피가 필요한 재료 ID들

  const missingIds = [...requiredIds].filter(id => !availableIds.has(id));
  
  return {
    isComplete: missingIds.length === 0,
    missingCount: missingIds.length,
    missingIngredientIds: missingIds,
  };
}
```

**사용처**: `GET /api/recipes/recommend`에서 모든 레시피를 순회하며 매칭 계산 후 정렬

---

## 5. UI/디자인 구현 가이드

### 5.1 컴포넌트 구조
모든 컴포넌트는 `app/components/`에 배치:

```
components/
  common/
    Button.tsx               # 4가지 상태 지원 (Primary/Secondary/Danger + disabled)
    Input.tsx                # 44px 높이, 포커스 스타일
    Badge.tsx                # 매칭 상태 배지 (완전/부분/새로움)
    Card.tsx                 # 레시피 카드 (이미지 16:9, 내용 구조 고정)
  layout/
    BottomNav.tsx            # 탭 3개 (나의 냉장고 | 레시피 추천 | 마이페이지)
    Header.tsx
  features/
    FridgeList.tsx           # 카테고리별 재료 목록
    RecipeDashboard.tsx      # 레시피 카드 그리드 + 필터
    RecipeDetail.tsx         # 상세 화면
```

### 5.2 스타일링 원칙
- **프레임워크**: Tailwind CSS (권장) 또는 CSS Modules
- **반응형**: Tailwind 기본값 (sm: 640px, md: 768px, lg: 1024px)
- **그리드 여백**: 8px 기본 단위 (8, 16, 24, 32, 48px)

**컬러 토큰** (CSS 변수 또는 Tailwind config):
```js
// tailwind.config.ts
colors: {
  primary: "#10B981",      // Fresh Green
  secondary: "#0EA5E9",    // Sky Blue
  accent: "#F97316",       // Warm Orange
  success: "#059669",      // 완전 매칭
  warning: "#D97706",      // 부족 상태
  error: "#DC2626",        // 삭제
  // 중성색
  darkGray: "#1F2937",
  lightGray: "#F3F4F6",
  disabledGray: "#9CA3AF",
}
```

### 5.3 반응형 레이아웃
- **모바일 (320px~767px)**: 하단 탭 네비, 단일 컬럼, 16px 패딩
- **태블릿 (768px~1023px)**: 2컬럼 카드, 24px 패딩
- **데스크톱 (1024px+)**: 3컬럼 카드, 32px 패딩, 최대 너비 1200px

### 5.4 접근성 준수
- **명도 대비**: 본문 4.5:1 이상 (WCAG AA)
- **터치 대상**: 44px 이상 (버튼, 토글, 탭)
- **포커스 표시**: 2px `#0EA5E9` 테두리
- **의미론적 마크업**: `<button>`, `<label for="">`, `alt` 텍스트, `aria-label`

```tsx
// 나쁜 예
<div onClick={handleClick}>추가</div>

// 좋은 예
<button onClick={handleClick} className="h-11 w-11">
  + 추가
</button>
```

### 5.5 애니메이션
- **기본 속도**: 200ms
- **ease 함수**: `cubic-bezier(0.4, 0, 0.2, 1)`
- **피해야 할 것**: 2초 이상의 과도한 애니메이션, 깜빡거림

---

## 6. 데이터베이스 및 API 원칙

### 6.1 스키마 변경
**모든 스키마 변경은 SQL 마이그레이션으로 관리**:

```
supabase/
  migrations/
    20260716120000_create_initial_schema.sql
    20260716130000_add_indexes.sql
```

Supabase 대시보드에서 직접 수정하지 말 것.

### 6.2 `recipes_cache` 구조의 핵심
```ts
{
  id: "12345",                    // 식약처 RCP_SEQ (PK)
  name: "떡볶이",
  raw_ingredients_text: "떡 500g, 고추장 2스푼...",  // 원본 API 응답
  parsed_ingredients: ["떡", "고추장", ...],         // 파싱된 재료명
  matched_ingredient_ids: ["uuid1", "uuid2", ...],   // ← 매칭 시 필수!
  cooking_steps: { /* 조리 순서 */ },
  image_url: "https://...",
  fetched_at: "2026-07-16T...",
}
```

`matched_ingredient_ids`를 통해 매칭 계산 시 **문자열 유사도 계산 없이 ID 배열 교집합만** 사용.

### 6.3 기본 조미료 (F4)
```ts
// ingredients_master에서 is_basic_seasoning = true
// 예: 설탕, 소금, 간장, 고추장, 참기름, 깨 등

// 매칭 시 항상 사용자가 보유한 것으로 간주
const basicSeasoningIds = await getBasicSeasoningIds();
const userOwnedWithBasic = new Set([
  ...userOwnedIngredientIds,
  ...basicSeasoningIds,
]);
```

### 6.4 CSV 파일 기반 레시피 데이터 로딩
**실시간 API 호출 불필요**, CSV 파일 기반 방식 사용:

```ts
// scripts/load-recipes-from-csv.ts (초기화 시 1회만 실행)
// 1. food_recipes_data.csv 파일 읽기
// 2. RCP_PARTS_DTLS 파싱 + ingredients_master와 대사
// 3. matched_ingredient_ids 계산
// 4. recipes_cache에 로드

// 배포 후 추천 요청은 모두 recipes_cache 조회
// GET /api/recipes/recommend → recipes_cache 스캔만 (CSV 재로드 불필요)
```

---

## 7. 보안 및 성능

### 7.1 보안 체크리스트
- [ ] `SUPABASE_SERVICE_ROLE_KEY`가 클라이언트 코드에 노출되지 않는가?
- [ ] CSV 파일(food_recipes_data.csv)이 공개 디렉토리에 노출되지 않는가?
- [ ] 모든 API에서 세션 확인 후 소유자 확인을 수행하는가?
- [ ] 모든 입력값이 Zod로 검증되는가?
- [ ] 에러 응답에 스택트레이스/쿼리문이 노출되지 않는가?

### 7.2 성능 고려사항
- **레시피 데이터**: CSV 파일에서 사전 로드된 recipes_cache, 추천 요청은 DB 조회만 (한 번의 DB 쿼리)
- **재료 검색**: `ingredients_master.name`/`synonyms`에 인덱스 (pg_trgm 또는 GIN)
- **페이지네이션**: `GET /api/recipes/recommend`는 `limit`/`offset` 파라미터 지원 (레시피 수 증가 시 대비)
- **모바일 최적화**: API 응답 페이로드 최소화 (목록은 필수 필드만, 상세는 상세 조회 API에서)

---

## 8. 개발 체크리스트

### 회원가입/로그인 (F1)
- [ ] Supabase Auth 클라이언트 `signUp`/`signInWithPassword` 구현
- [ ] 세션 만료 시 자동 갱신 (middleware.ts)
- [ ] 로그아웃 버튼

### 식재료 검색/등록 (F2)
- [ ] `GET /api/ingredients/search?q=` 구현 (자동완성, 최대 10개)
- [ ] `POST /api/fridge` 구현 (중복 체크)
- [ ] 입력 포커스 시 드롭다운 표시

### 나의 냉장고 (F3)
- [ ] 카테고리별 그룹핑 표시
- [ ] `PATCH /api/fridge/[id]` (보유 여부 토글)
- [ ] `DELETE /api/fridge/[id]` (재료 삭제)
- [ ] 재료 없을 때 빈 상태 UI

### 기본 조미료 (F4)
- [ ] `ingredients_master`에 `is_basic_seasoning` 플래그
- [ ] 매칭 시 자동 포함

### 레시피 추천 (F5, F6, F7)
- [ ] `GET /api/recipes/recommend?filter=complete|partial|all` 구현
- [ ] 완전 보유 → 부족 개수 적은 순 정렬
- [ ] 각 카드에 매칭 배지 표시 (완전/부분)

### 레시피 상세 (F8)
- [ ] `GET /api/recipes/[id]` 구현
- [ ] 전체 재료 목록 (보유/부족 강조)
- [ ] 조리 순서 표시
- [ ] 공유 버튼 (선택사항)

### 반응형 웹/모바일 (F9)
- [ ] 모바일 (320px) ~ 데스크톱 (1024px+) 테스트
- [ ] 탭 네비게이션 (모바일) ↔ 사이드바 (데스크톱) 전환
- [ ] 이미지 최적화 (next/image 활용)

---

## 9. 환경변수 (.env.local 예시)

```
# Supabase (클라이언트, 노출 가능)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# Supabase (서버만, .local만 설정)
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

```

`.env.local`은 `.gitignore`에 포함, `.env.example`에 빈 값으로 기록.

참고: `FOOD_SAFETY_API_KEY`는 CSV 파일 기반 방식으로 변경되어 더 이상 필요하지 않습니다.

---

## 10. 배포 및 운영

### Vercel 배포
```bash
vercel deploy
# 또는 git push → GitHub Actions 자동 배포
```

### DB 마이그레이션
```bash
# 로컬 개발
supabase migration new migration_name

# 원격 적용
supabase db push
```


### CSV 파일 로드 (초기화)
```bash
# 로컬에서 수동 실행 (최초 1회)
npx ts-node scripts/load-recipes-from-csv.ts

# 또는 배포 후 DB 세팅이 완료되면 실행

```

---

## 11. 주의사항

### MVP 범위 (P0)만 구현
- F1~F9만 구현, F10(유통기한)/F11(OCR)/F12(바코드)는 나중에
- 미리 컬럼을 추가하거나 API를 만들지 말 것

### 과도한 최적화 금지
- 초기에는 레시피 캐싱(배치)만으로 충분
- 사용자/레시피 수가 증가해서 성능 이슈가 생기면 그때 재평가

### 에러 로깅
- 예상 가능한 에러: 사용자에게 친화적인 메시지 반환
- 예상치 못한 에러: 서버 로그에 기록, 사용자에게는 "일반적인 오류" 메시지만 반환

### 테스트
- Route Handler/API: 단위 테스트 (Vitest)
- UI 컴포넌트: 스크린샷 테스트 (Storybook, Playwright)
- 통합: E2E 테스트 (Playwright)

---

## 12. 변경 관리

이 문서를 변경할 때는:
1. PR 설명에 변경 내용을 명시
2. 연관된 `PRD.md`, `UI-UX-Guideline.md`, `Backend-Guideline.md`도 함께 갱신

---

**문서 버전**: v1.0  
**작성일**: 2026-07-16  
**마지막 수정일**: 2026-07-16
