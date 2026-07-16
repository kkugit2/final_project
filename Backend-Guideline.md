# Backend Guideline — 냉장고 재료 기반 레시피 추천 앱

## 0. 문서 목적

이 문서는 Next.js를 중심으로 개발하는 "냉장고 재료 기반 레시피 추천 앱"의 백엔드(서버) 영역 개발 규칙을 정의합니다. Next.js는 프론트엔드뿐 아니라 **Route Handler / Server Action을 통해 백엔드 역할도 함께 수행**하므로, 별도의 백엔드 서버 없이도 아래 규칙을 따르면 일관된 서버 로직을 유지할 수 있습니다.

팀원 전체가 아래 규칙을 따르며, 규칙을 벗어나야 하는 경우 PR에 이유를 명시합니다.

---

## 1. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js (App Router) | Route Handler(`app/api/**/route.ts`) + Server Action 병행 |
| 언어 | TypeScript | `any` 사용 금지, strict 모드 유지 |
| DB | Supabase (PostgreSQL) | 프로젝트당 단일 DB, 스키마는 `public` 사용 |
| 인증 | Supabase Auth | 이메일/소셜 로그인, RLS와 연동 |
| 외부 데이터 | 외부 레시피 API (예: 식품안전나라 공공데이터, Spoonacular 등) | 서버에서만 호출, 결과 캐싱 |
| 유효성 검증 | Zod | 모든 입력값(요청 body, query)에 스키마 적용 |
| 배포 | Vercel + Supabase | 환경변수는 Vercel 프로젝트 설정에서 관리 |

---

## 2. 아키텍처 개요

```
[Client (React Components)]
        │  fetch / Server Action 호출
        ▼
[Next.js Route Handler / Server Action]   ← "백엔드" 계층
        │
        ├─ Zod로 입력 검증
        ├─ Supabase Server Client 생성 (쿠키 기반 세션)
        ├─ 비즈니스 로직 (lib/services/*)
        │       ├─ DB 조회/변경 (Supabase)
        │       └─ 외부 레시피 API 호출 + 캐싱
        └─ 표준 응답 포맷으로 반환
```

- **DB 직접 접근은 Server Component, Route Handler, Server Action에서만** 수행합니다. 클라이언트 컴포넌트에서 Supabase 클라이언트로 직접 쓰기 작업을 하지 않습니다(읽기 전용 realtime 구독은 예외).
- 비즈니스 로직(재료 매칭, 추천 스코어링 등)은 Route Handler에 직접 작성하지 않고 `lib/services/` 아래 함수로 분리합니다. Route Handler는 요청/응답 변환 + 검증 + 서비스 호출만 담당합니다.

---

## 3. 폴더 구조

```
app/
  api/
    ingredients/
      route.ts              # GET(목록), POST(추가)
      [id]/route.ts          # PATCH, DELETE
    recipes/
      recommend/route.ts     # POST: 보유 재료 기반 추천
      [id]/route.ts          # GET: 상세
  (actions)/
    ingredient-actions.ts    # Server Action (form 제출 등)
lib/
  supabase/
    server.ts                # 서버용 Supabase 클라이언트 생성
    client.ts                # 브라우저용 Supabase 클라이언트 생성
    middleware.ts            # 세션 갱신용 (Next.js middleware)
  services/
    ingredient-service.ts    # 재료 CRUD 비즈니스 로직
    recipe-service.ts        # 레시피 매칭/추천 로직
    external-recipe-api.ts   # 외부 API 연동 wrapper
  validators/
    ingredient.schema.ts     # Zod 스키마
    recipe.schema.ts
  utils/
    api-response.ts          # 표준 응답 헬퍼
    errors.ts                 # 커스텀 에러 클래스
types/
  database.types.ts          # Supabase CLI로 생성한 DB 타입
supabase/
  migrations/                # SQL 마이그레이션 파일
```

---

## 4. 데이터베이스 설계 원칙 (Supabase/PostgreSQL)

### 4.1 기본 테이블 (초안)

- `profiles` — Supabase Auth `auth.users`와 1:1 연결되는 사용자 프로필
- `ingredients_master` — 재료 마스터(이름, 카테고리, 유통기한 기준일 등)
- `user_ingredients` — 사용자별 보유 재료(냉장고 인벤토리): `user_id`, `ingredient_id`, `quantity`, `expires_at`
- `recipes_cache` — 외부 API에서 가져온 레시피를 캐싱하는 테이블(재호출 최소화)
- `recipe_ingredients` — 레시피-재료 매핑(추천 매칭 쿼리에 사용)
- `favorites` — 사용자가 즐겨찾기한 레시피

### 4.2 규칙

- 모든 테이블에 `id (uuid, default gen_random_uuid())`, `created_at`, `updated_at` 컬럼을 기본으로 둡니다.
- 외래키는 반드시 명시하고 `on delete cascade`/`set null` 정책을 테이블 설계 시 결정합니다(예: 유저 삭제 시 `user_ingredients`도 함께 삭제).
- 스키마 변경은 항상 `supabase/migrations/`에 SQL 마이그레이션 파일로 남깁니다. Supabase 대시보드에서 직접 테이블을 수정하지 않습니다(로컬 마이그레이션과 어긋나는 것을 방지).
- 테이블/컬럼명은 `snake_case`, TypeScript 타입은 Supabase CLI로 자동 생성(`supabase gen types typescript`)하여 `types/database.types.ts`에 반영, 수동 수정하지 않습니다.

### 4.3 Row Level Security (RLS)

- **모든 사용자 데이터 테이블은 RLS를 반드시 활성화**합니다(`user_ingredients`, `favorites` 등).
- 기본 정책: 본인 `user_id = auth.uid()`인 행만 조회/수정 가능.
- `ingredients_master`, `recipes_cache`처럼 공용 참조 데이터는 RLS로 전체 사용자 `select`는 허용하되 `insert/update/delete`는 서비스 role(서버)만 가능하도록 제한합니다.
- RLS 정책도 마이그레이션 파일에 SQL로 함께 커밋합니다.

---

## 5. 인증/인가 (Supabase Auth)

- 서버(Route Handler, Server Action, Server Component)에서는 `lib/supabase/server.ts`의 쿠키 기반 서버 클라이언트를 사용해 세션을 읽습니다. 클라이언트에서 발급한 토큰을 body로 전달받아 신뢰하지 않습니다.
- 세션 만료 갱신은 Next.js `middleware.ts`에서 Supabase 세션 refresh 로직으로 처리합니다.
- 인증이 필요한 모든 Route Handler/Server Action은 진입 시 아래 순서로 검사합니다:
  1. 서버 Supabase 클라이언트로 세션 확인 → 없으면 401 반환
  2. 필요한 경우 리소스 소유자 확인(예: 본인 재료만 수정 가능) → 아니면 403 반환
- 클라이언트에는 `service_role` 키를 절대 노출하지 않습니다. `service_role` 키는 서버 전용 환경변수로만 사용(예: 외부 API 결과를 `recipes_cache`에 쓰는 배치/서버 작업).

---

## 6. API 설계 규칙

### 6.1 라우트 규칙

- REST 리소스 기준으로 설계: `GET /api/ingredients`, `POST /api/ingredients`, `PATCH /api/ingredients/[id]`, `DELETE /api/ingredients/[id]`
- 단순 조회/등록 위주 폼 제출은 Route Handler 대신 **Server Action**을 우선 사용해 클라이언트-서버 보일러플레이트를 줄입니다. 외부에 공개할 필요가 있는 API(추천 로직 등 다른 클라이언트에서도 호출 가능성 있는 것)는 Route Handler로 작성합니다.
- 추천 로직처럼 여러 파라미터(보유 재료 목록, 필터 조건)를 받는 경우 `POST`를 사용합니다(GET query string 길이/구조 한계 회피).

### 6.2 요청 검증

- 모든 요청 body/query는 Zod 스키마로 파싱합니다. 실패 시 400과 함께 에러 상세를 반환합니다.

```ts
// lib/validators/ingredient.schema.ts
import { z } from "zod";

export const createIngredientSchema = z.object({
  name: z.string().min(1).max(50),
  quantity: z.number().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});
```

### 6.3 표준 응답 포맷

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

- 성공 시 항상 `{ success: true, data }`, 실패 시 `{ success: false, error: { code, message } }` 형태를 유지합니다.
- HTTP status code는 의미에 맞게 사용: `200`(조회/성공), `201`(생성), `400`(검증 실패), `401`(미인증), `403`(권한 없음), `404`(리소스 없음), `409`(충돌), `500`(서버 오류).

### 6.4 에러 처리

- 서비스 계층에서 예상 가능한 예외(예: "재료 없음", "이미 즐겨찾기됨")는 커스텀 에러 클래스(`lib/utils/errors.ts`)로 던지고, Route Handler 최상단에서 공통 catch로 매핑해 응답합니다.
- 예상치 못한 에러는 로그를 남기고 500 + 일반화된 메시지만 클라이언트에 반환합니다(내부 스택/쿼리 노출 금지).

---

## 7. 외부 레시피 API 연동

- 외부 API 호출은 반드시 **서버 코드(`lib/services/external-recipe-api.ts`)에서만** 수행합니다. API Key는 클라이언트에 절대 노출하지 않고 서버 전용 환경변수(`.env.local`, Vercel 환경변수)에 저장합니다(`NEXT_PUBLIC_` 접두사 사용 금지).
- 외부 API 응답은 그대로 클라이언트에 전달하지 않고, 우리 서비스에서 필요한 필드만 매핑한 내부 타입으로 변환 후 반환합니다(외부 스펙 변경에 대한 영향 최소화).
- **캐싱 전략**: 동일 조건(재료 조합, 검색 키워드) 호출에 대해 외부 API를 매번 호출하지 않도록
  - 단기 캐시: Next.js `fetch`의 `cache`/`revalidate` 옵션 활용
  - 중기 캐시: 결과를 `recipes_cache` 테이블에 저장해두고 재사용, 일정 기간(예: 7일) 후 만료 처리
- 외부 API의 요청 한도(rate limit)를 확인하고, 초과 시 캐시된 데이터로 우선 응답하는 fallback 로직을 둡니다.
- 외부 API 장애 시에도 자체 DB에 저장된 캐시/자체 등록 레시피로 최소한의 추천이 가능하도록 설계합니다(단일 장애 지점 방지).

---

## 8. 레시피 추천 로직 배치 원칙

- 추천 알고리즘(보유 재료-레시피 매칭 스코어링)은 `lib/services/recipe-service.ts`에 순수 함수 형태로 작성하고 단위 테스트를 작성합니다.
- 1차 필터링(재료 매칭 후보 축소)은 DB 쿼리(SQL)로 처리하고, 스코어링/정렬 같은 세부 로직만 애플리케이션 코드에서 수행하여 불필요하게 큰 데이터를 애플리케이션 레이어로 가져오지 않습니다.

---

## 9. 환경변수 관리

- `.env.local`은 git에 커밋하지 않고 `.env.example`에 필요한 키 목록만 값 없이 기록합니다.
- 네이밍 규칙:
  - 클라이언트에서도 필요한 값: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - 서버 전용 값(절대 `NEXT_PUBLIC_` 붙이지 않음): `SUPABASE_SERVICE_ROLE_KEY`, `RECIPE_API_KEY`
- Vercel 배포 시 Production/Preview/Development 환경변수를 구분해서 등록합니다.

---

## 10. 보안 체크리스트

- [ ] 모든 사용자 데이터 테이블 RLS 활성화 확인
- [ ] `service_role` 키가 클라이언트 코드/브라우저 네트워크 탭에 노출되지 않는지 확인
- [ ] 모든 입력값 Zod 검증 통과 여부
- [ ] 리소스 접근 시 소유자 확인(다른 유저의 재료/즐겨찾기 조작 불가) 여부
- [ ] 외부 API 키가 서버 환경변수로만 존재하는지 확인
- [ ] 에러 응답에 스택트레이스/쿼리문 등 내부 정보 노출 금지

---

## 11. 코드 컨벤션 (백엔드 관련)

- 파일명: `kebab-case.ts` (예: `recipe-service.ts`)
- 함수/변수: `camelCase`, 타입/인터페이스: `PascalCase`
- 서비스 함수는 Supabase 클라이언트를 인자로 받거나 내부에서 서버 클라이언트를 생성하되, **테스트 가능하도록 순수 로직과 DB 접근을 분리**하는 것을 지향합니다.
- 하나의 Route Handler/Server Action 함수는 "검증 → 인증/인가 확인 → 서비스 호출 → 응답 변환" 흐름을 넘지 않도록 하고, 복잡한 로직은 서비스 계층으로 이동합니다.

---

## 12. 배포 및 운영

- 배포: Vercel(Next.js) + Supabase(DB/Auth)
- DB 마이그레이션은 배포 전 `supabase db push` 또는 CI 파이프라인에서 적용하고, 코드 배포와 순서를 맞춥니다(마이그레이션 먼저 적용 후 코드 배포).
- 운영 중 외부 레시피 API 응답 지연/실패는 로그로 남겨 추후 캐시 정책 조정에 활용합니다.

---

## 13. 변경 관리

- 이 문서(DB 스키마, API 응답 포맷, 인증 규칙 등)에 영향을 주는 변경은 PR 설명에 명시하고, 필요 시 이 문서를 함께 업데이트합니다.
