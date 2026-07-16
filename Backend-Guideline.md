# Backend Guideline — 냉장고 재료 기반 레시피 추천 서비스

> 본 문서는 `PRD.md` (v1.0, 2026-07-16)를 기준으로 작성되었습니다. PRD가 갱신되면 이 문서도 함께 갱신합니다.

## 0. 문서 목적

Next.js를 중심으로 개발하는 "냉장고 재료 기반 레시피 추천 서비스"의 백엔드 개발 규칙을 정의합니다. 별도 백엔드 서버 없이 Next.js Route Handler/Server Action이 백엔드 역할을 겸합니다. MVP(P0) 범위는 PRD 3장의 F1~F9이며, 이 문서도 해당 범위를 기준으로 작성합니다. F10(유통기한)/F11(OCR)/F12(바코드)/F13(네이티브 앱)은 차기 단계이므로 지금 단계에서 스키마/API를 과도하게 미리 설계하지 않습니다(11장 참고).

---

## 1. 기술 스택 (PRD 5장 기준)

| 영역 | 선택 | 비고 |
|---|---|---|
| 프론트엔드 + 백엔드 | Next.js (App Router, 풀스택) | Route Handler로 식약처 API 프록시, 인증 로직 처리 |
| 인증 | Supabase Auth | 이메일 기반 회원가입/로그인 (F1) |
| 데이터베이스 | Supabase (PostgreSQL) | 사용자-재료-레시피 관계형 데이터 |
| 외부 API | 식품의약품안전처 조리식품 레시피 DB (COOKRCP01) | 무료 공공 데이터, 서버에서만 호출 |
| 배포 | Vercel | Next.js 배포 최적화 |
| 언어/검증 | TypeScript + Zod | strict 모드, 모든 입력값 스키마 검증 |

---

## 2. 아키텍처 개요

```
[Client (React Components)]
        │  fetch / Server Action 호출
        ▼
[Next.js Route Handler / Server Action]
        │
        ├─ Zod로 입력 검증
        ├─ Supabase Server Client 생성 (쿠키 기반 세션)
        ├─ 비즈니스 로직 (lib/services/*)
        │       ├─ 식재료 검색/냉장고 CRUD (Supabase)
        │       ├─ 레시피 매칭 계산 (실시간, 저장하지 않음 — 6.2절)
        │       └─ 식약처 API 호출 + recipes_cache 적재 (배치)
        └─ 표준 응답 포맷으로 반환
```

- DB 쓰기/읽기는 Server Component, Route Handler, Server Action에서만 수행합니다. 클라이언트 컴포넌트에서 Supabase에 직접 쓰기 작업을 하지 않습니다.
- **레시피 매칭 결과는 DB에 저장하지 않고 요청 시점에 계산**합니다(PRD 6.2절 가정). 매칭 로직은 `lib/services/recipe-matching.ts`에 순수 함수로 분리합니다.

---

## 3. 폴더 구조

```
app/
  api/
    ingredients/
      search/route.ts        # GET: 식재료 검색 (F2 자동완성)
    fridge/
      route.ts                # GET(내 냉장고 목록), POST(재료 추가)
      [id]/route.ts            # PATCH(보유 여부 토글), DELETE
    recipes/
      recommend/route.ts       # GET: 추천 목록 (F5, F6, F7)
      [id]/route.ts             # GET: 레시피 상세 (F8)
lib/
  supabase/
    server.ts                  # 서버용 Supabase 클라이언트
    client.ts                  # 브라우저용 Supabase 클라이언트
    middleware.ts               # 세션 갱신 (Next.js middleware)
  services/
    ingredient-service.ts       # ingredients_master 검색
    fridge-service.ts            # user_fridge CRUD (F2, F3, F4)
    recipe-service.ts            # recipes_cache 조회, 상세 조회
    recipe-matching.ts           # 보유 재료-레시피 매칭 계산 (F4, F7)
    external-recipe-api.ts       # 식약처 API 연동 + 캐싱 적재
  validators/
    fridge.schema.ts
    recipe.schema.ts
  utils/
    api-response.ts
    errors.ts
scripts/
  sync-recipes.ts                # 식약처 API 전체 수집 → recipes_cache 배치 스크립트
types/
  database.types.ts              # Supabase CLI 자동 생성
supabase/
  migrations/
```

---

## 4. 데이터베이스 스키마 (PRD 6장 기준)

### 4.1 `ingredients_master` — 사전 등록된 식재료 검색 DB

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | 재료 고유 ID |
| name | text | 재료명 (예: 돼지고기, 양파) |
| category | text | 카테고리 (육류/채소/유제품/조미료 등) |
| synonyms | text[] | 동의어 목록 (예: 대파 → 파, 쪽파) — 레시피 매칭용 |
| is_basic_seasoning | boolean | true면 매칭 시 항상 보유로 간주 (F4) |

- `name`, `synonyms`에는 검색/매칭 성능을 위해 인덱스(`pg_trgm` 또는 `GIN`)를 고려합니다.
- 이 테이블은 참조 데이터이므로 RLS는 "전체 조회 허용, 쓰기는 서비스 role만"으로 설정합니다.

### 4.2 `user_fridge` — 사용자별 보유 재료

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | 레코드 ID |
| user_id | uuid (FK → auth.users.id) | 소유 사용자 |
| ingredient_id | uuid (FK → ingredients_master.id) | 등록된 재료 |
| is_owned | boolean | 보유 여부 (체크/토글) |
| updated_at | timestamp | 최종 수정일 |

- `(user_id, ingredient_id)`에 유니크 제약을 걸어 동일 재료 중복 등록을 방지합니다.
- 유통기한(F10), 수량은 MVP 범위에 없으므로 지금 컬럼을 추가하지 않습니다. 필요해지면 마이그레이션으로 추가합니다.

### 4.3 `recipes_cache` — 식약처 API 응답 캐시

| 필드 | 타입 | 설명 |
|---|---|---|
| id | text (PK) | 식약처 API 레시피 고유 ID (`RCP_SEQ`를 그대로 사용) |
| name | text | 요리명 |
| raw_ingredients_text | text | API 원본 재료 텍스트 (`RCP_PARTS_DTLS`) |
| parsed_ingredients | jsonb | 파싱/정규화된 재료명 배열 |
| cooking_steps | jsonb | 조리 순서 |
| image_url | text | 완성 이미지 URL |
| fetched_at | timestamp | API 조회/캐싱 시각 |

- `id`를 외부 API의 `RCP_SEQ`로 그대로 사용하여 재적재 시 `upsert`로 중복 없이 갱신합니다.
- 참조 데이터이므로 RLS는 "전체 조회 허용, 쓰기는 서비스 role(배치 스크립트)만"으로 설정합니다.
- 매칭에 쓰이는 `parsed_ingredients`는 원재료명 문자열 배열이 아니라, 캐싱 단계에서 `ingredients_master`(및 `synonyms`)와 대사(alias resolve)하여 **`ingredients_master.id` 배열도 함께 저장**하는 것을 권장합니다(예: `matched_ingredient_ids uuid[]`). 매칭 시점에 매번 문자열 유사도 계산을 하지 않고 ID 배열 교집합 연산만 하도록 하여 쿼리 성능을 확보합니다.

### 4.4 관계 및 RLS

- `user` : `user_fridge` = 1:N, `user_fridge` : `ingredients_master` = N:1 (PRD 6.2절과 동일)
- `user_fridge`는 사용자 개인 데이터이므로 RLS 필수: `user_id = auth.uid()`인 행만 조회/수정 가능.
- 모든 스키마 변경은 `supabase/migrations/`에 SQL로 커밋하고, Supabase 대시보드에서 직접 수정하지 않습니다.

---

## 5. 인증/인가 (F1)

- Supabase Auth의 이메일 회원가입/로그인 기본 플로우를 사용합니다.
- 서버(Route Handler, Server Action, Server Component)는 `lib/supabase/server.ts`의 쿠키 기반 클라이언트로 세션을 읽습니다. 클라이언트가 보낸 사용자 ID를 신뢰하지 않고 항상 세션에서 추출합니다.
- `user_fridge` 관련 모든 API는 진입 시: 세션 확인(401) → 요청 대상 레코드의 소유자 확인(403) 순으로 검사합니다.
- `service_role` 키는 서버 전용 환경변수로만 사용하며(예: `scripts/sync-recipes.ts` 배치 작업), 클라이언트에 노출하지 않습니다.

---

## 6. API 명세 (F1~F9 매핑)

### 6.1 엔드포인트 목록

| 기능 | 메서드/경로 | 설명 |
|---|---|---|
| F2 식재료 검색 | `GET /api/ingredients/search?q=` | `ingredients_master`에서 이름/동의어로 자동완성 검색 |
| F2, F3 내 냉장고 목록 | `GET /api/fridge` | 카테고리별 그룹핑된 보유 재료 목록 반환 |
| F2, F3 재료 추가 | `POST /api/fridge` | `{ ingredientId }`로 `user_fridge` 레코드 생성/토글 |
| F3, F4 보유 여부 토글 | `PATCH /api/fridge/[id]` | `{ isOwned: boolean }` |
| F3 재료 삭제 | `DELETE /api/fridge/[id]` | `user_fridge` 레코드 제거 |
| F5, F6, F7 레시피 추천 | `GET /api/recipes/recommend?filter=complete\|partial\|all` | 매칭 계산 후 완전 보유 우선 정렬 목록 |
| F8 레시피 상세 | `GET /api/recipes/[id]` | 전체 재료/조리법 + 보유·부족 재료 표시 |

- 회원가입/로그인 자체는 Supabase Auth 클라이언트 SDK(`supabase.auth.signUp`, `signInWithPassword`)를 프론트에서 직접 호출하는 것을 기본으로 하고, 별도 커스텀 인증 API는 만들지 않습니다.

### 6.2 레시피 추천/매칭 로직 (F4, F5, F6, F7)

`lib/services/recipe-matching.ts`에 다음 순서로 구현합니다.

1. 현재 사용자의 `user_fridge`에서 `is_owned = true`인 `ingredient_id` 집합을 가져온다.
2. `ingredients_master`에서 `is_basic_seasoning = true`인 재료 ID 집합을 가져와 위 집합에 **합집합**으로 추가한다(F4: 기본 조미료는 미등록이어도 항상 보유로 간주).
3. `recipes_cache.matched_ingredient_ids`(4.3절)와 위에서 구한 "보유 재료 ID 집합"을 비교하여 레시피별로 `필요재료 - 보유재료 = 부족재료`를 계산한다.
4. 부족재료가 0개면 "완전 보유", 1개 이상이면 "일부 보충 필요"로 분류한다.
5. 정렬: 완전 보유 → 부족재료 개수 적은 순 (F5).
6. `filter` 쿼리 파라미터로 `complete`/`partial`만 선택 조회 가능하게 한다(F6).
7. **이 계산 결과는 저장하지 않고 매 요청마다 재계산**한다(PRD 6.2절 가정). 사용자/레시피 수가 늘어나 성능 이슈가 생기면 그때 캐싱 여부를 재검토한다(지금 미리 최적화하지 않음).

레시피 상세(F8)는 위 매칭 결과에서 해당 레시피 하나만 뽑아 `raw_ingredients_text`/`parsed_ingredients`와 함께 보유/부족 표시를 붙여 반환합니다.

### 6.3 요청 검증 & 표준 응답

- 모든 요청 body/query는 Zod로 검증합니다.

```ts
// lib/validators/recipe.schema.ts
import { z } from "zod";

export const recommendQuerySchema = z.object({
  filter: z.enum(["complete", "partial", "all"]).default("all"),
});
```

- 응답 포맷은 아래로 통일합니다.

```ts
// lib/utils/api-response.ts
export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; error: { code: string; message: string } };

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function fail(code: string, message: string): ApiError {
  return { success: false, error: { code, message } };
}
```

- Status code: `200`(조회), `201`(생성), `400`(검증 실패), `401`(미인증), `403`(권한 없음), `404`(리소스 없음), `500`(서버 오류).
- 예상 가능한 예외는 커스텀 에러 클래스(`lib/utils/errors.ts`)로 던지고 공통 catch에서 매핑, 예상치 못한 에러는 로그 후 500 + 일반화된 메시지만 반환합니다(내부 정보 노출 금지).

---

## 7. 식약처 외부 API 연동 (COOKRCP01)

- 호출은 `lib/services/external-recipe-api.ts`(서버 전용)에서만 수행하고, API 키는 `FOOD_SAFETY_API_KEY` 서버 환경변수로 관리합니다(`NEXT_PUBLIC_` 금지).
- 엔드포인트: `http://openapi.foodsafetykorea.go.kr/api/{키}/COOKRCP01/json/{시작번호}/{종료번호}` (최대 1000건/호출).
- `RCP_PARTS_DTLS`는 비정형 텍스트이므로 파싱 후 `ingredients_master.name`/`synonyms`와 대사하여 `parsed_ingredients` + `matched_ingredient_ids`로 정규화합니다(4.3절).
- **실시간 호출이 아니라 배치 적재 방식**을 사용합니다: `scripts/sync-recipes.ts`를 실행해 전체 레시피를 가져와 `recipes_cache`에 `upsert`합니다. 사용자의 추천 요청(F5)은 이 캐시 테이블만 조회하고 외부 API를 직접 호출하지 않습니다.
- API 응답 코드(`RESULT.CODE`)가 `INFO-000`이 아니면 에러로 처리하고, 트래픽 한도 초과(`ERROR-336`, `ERROR-337`) 시에는 배치를 중단하고 이미 적재된 캐시로 서비스를 계속 운영합니다.

---

## 8. 반응형 웹/모바일 대응 관련 백엔드 고려사항 (F9)

- 백엔드 자체는 웹/모바일에 따라 분기하지 않지만, 응답 페이로드를 가볍게 유지해 모바일 네트워크에서도 로딩이 느리지 않도록 합니다.
- `GET /api/recipes/recommend`는 카드 목록에 필요한 필드만 반환(썸네일 URL, 이름, 부족재료 개수 등)하고, 상세 필드(전체 조리 순서 등)는 `GET /api/recipes/[id]`에서만 내려줍니다.
- 목록 API는 처음부터 페이지네이션(`limit`/`cursor` 또는 `page`)을 파라미터로 열어두어, 추후 레시피 수가 늘어나도 대응 가능하게 합니다.

---

## 9. 보안 체크리스트

- [ ] `user_fridge` RLS 활성화 및 `user_id = auth.uid()` 정책 확인
- [ ] `ingredients_master`, `recipes_cache` 쓰기 권한이 서비스 role로만 제한되는지 확인
- [ ] `service_role`/`FOOD_SAFETY_API_KEY`가 클라이언트 코드/네트워크 탭에 노출되지 않는지 확인
- [ ] 모든 입력값 Zod 검증 통과 여부
- [ ] `user_fridge` 레코드 접근 시 소유자 확인(다른 사용자 냉장고 조작 불가) 여부
- [ ] 에러 응답에 스택트레이스/쿼리문 등 내부 정보 노출 금지

---

## 10. 환경변수

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # 서버 전용
FOOD_SAFETY_API_KEY=              # 서버 전용
```

- `.env.local`은 git에 커밋하지 않고, 필요한 키 목록은 `.env.example`에 값 없이 기록합니다.

---

## 11. 차기 단계(P1/P2) 대비 원칙

지금은 F1~F9(MVP)만 구현하며, 아래는 실제로 착수하는 시점에 마이그레이션/설계를 추가합니다. 미리 컬럼이나 API를 만들어두지 않습니다.

- F10 유통기한 관리: `user_fridge`에 `expires_at` 컬럼과 알림 배치가 필요해질 시점에 추가
- F11 사진/OCR 재료 인식, F12 바코드 스캔: 별도 인식 결과를 `user_fridge` 등록 입력으로 변환하는 어댑터 계층만 추가되면 되므로, 기존 `POST /api/fridge` 계약을 바꾸지 않는 방향으로 설계
- F13 네이티브 앱 전환: 현재 API가 Next.js Route Handler 기반 REST 형태를 유지하면 React Native 등에서도 그대로 재사용 가능하도록, 특정 클라이언트(웹)에 종속적인 응답 구조를 만들지 않음

---

## 12. 코드 컨벤션

- 파일명 `kebab-case.ts`, 함수/변수 `camelCase`, 타입/인터페이스 `PascalCase`
- Route Handler/Server Action은 "검증 → 인증/인가 → 서비스 호출 → 응답 변환" 흐름만 담당하고, 매칭 로직 등 복잡한 계산은 `lib/services/`로 분리
- DB 타입은 `supabase gen types typescript`로 생성한 `types/database.types.ts`를 사용하고 수동 수정하지 않음

---

## 13. 배포 및 운영

- 배포: Vercel(Next.js) + Supabase(DB/Auth)
- `scripts/sync-recipes.ts`는 배포 코드와 별개로 필요 시(최초 1회 또는 주기적) 수동/스케줄 실행하며, 매 배포마다 자동 실행하지 않음
- DB 마이그레이션은 코드 배포 전에 적용

---

## 14. 변경 관리

- 이 문서에 영향을 주는 변경(스키마, API 응답 포맷, 인증 규칙, PRD 기능 범위 변경 등)은 PR 설명에 명시하고, 이 문서와 `PRD.md`를 함께 갱신합니다.
