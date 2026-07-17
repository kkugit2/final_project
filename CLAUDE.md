# CLAUDE.md - 냉장고 재료 기반 레시피 추천 서비스 개발 지침

Claude Code로 이 프로젝트를 작업할 때 반드시 참고하세요.

> 이 문서는 PRD_.md, BACKEND-INTEGRATED.md, FRONTEND.md, UI-UX-Guideline.md와 상충하지 않도록 다시 작성되었습니다. 이전 버전의 CLAUDE.md는 Vanilla JS + localStorage + 로컬 인증 폴백 구조를 전제로 하고 있었으나, 이는 프로젝트 전체 방향(Next.js + Supabase 서버 저장)과 맞지 않아 전면 교체되었습니다.

---

## 1. 프로젝트 개요

**서비스명(가칭)**: 냉장고 재료 기반 레시피 추천 서비스

사용자가 보유한 식재료를 검색해서 등록하면, 실제로 만들 수 있는 요리(완전 보유) 또는 조금만 더 사면 만들 수 있는 요리(일부 부족)를 추천해주는 웹/모바일 서비스입니다. 레시피 데이터는 식품의약품안전처 공공데이터를 CSV로 받아 서버에 1회 적재해서 사용합니다.

**관련 문서 (반드시 함께 참고)**
- `PRD_.md` — 전체 요구사항, 기능 목록(F1~F20), 개발 우선순위
- `BACKEND-INTEGRATED.md` — DB 스키마, API 명세, 비즈니스 로직, 보안/RLS
- `FRONTEND.md` — 화면 구성, 상태 관리, 컴포넌트 목록
- `UI-UX-Guideline.md` — 컬러(Steel Blue 단일 계열), 타이포그래피, 컴포넌트 스펙

이 문서(CLAUDE.md)는 위 네 문서의 요약이 아니라, **Claude Code가 실제 코드를 짤 때 참고할 실무 규칙**만 담습니다. 기능/화면 스펙이 궁금하면 위 문서를 먼저 확인하세요.

---

## 2. 기술 스택 (PRD_.md 5장 기준)

- **프론트엔드 + 백엔드**: Next.js (App Router, 풀스택) — **Vanilla JS/정적 HTML 방식이 아님**
- **인증**: Supabase Auth (이메일 기반) — **로컬 폴백 인증 없음** (비밀번호를 브라우저에 저장하는 방식은 사용하지 않음)
- **데이터베이스**: Supabase PostgreSQL
- **레시피 데이터**: 식약처 공공데이터 CSV → **서버에서 1회 적재 스크립트로 `recipes` 테이블에 저장** (클라이언트가 CSV를 직접 fetch/파싱하지 않음)
- **배포**: Vercel

> 별도 백엔드 서버(Express, NestJS 등)를 두지 않습니다. "백엔드"는 Next.js API Route를 의미합니다.

---

## 3. 핵심 아키텍처

### 3.1 데이터 흐름
```
[사용자] 재료 검색/등록
  ↓
[Next.js 프론트] fetch로 API Route 호출
  ↓
[Next.js API Route] Supabase 세션 검증 → DB 조회/기록
  ↓
[Supabase Postgres] user_fridge, recipes, ingredients_master 등
```

- 레시피 매칭(완전 보유/일부 부족 계산)은 **API Route 안에서 서버 사이드로 계산**해서 클라이언트에 결과만 내려줌 (클라이언트가 직접 매칭 로직을 돌리지 않음)
- 재료 검색은 부분 문자열 매칭(`ILIKE '%검색어%'` 또는 동등 로직). 마스터 DB 규모가 작으면 프론트 캐싱도 가능(FRONTEND.md 참고)

### 3.2 인증
- Supabase Auth만 사용. 네트워크 오류 시에도 로컬 계정으로 우회하지 않고 "잠시 후 다시 시도" 안내만 제공
- 모든 API Route는 로그인 세션이 없으면 401 반환

### 3.3 데이터 저장
- 사용자 냉장고 데이터는 **반드시 Supabase `user_fridge` 테이블**에 저장 (localStorage에 원본 데이터를 저장하지 않음)
- 클라이언트 상태 관리(React Query/SWR 등)는 서버 데이터의 캐시일 뿐, 소스 오브 트루스는 항상 DB

---

## 4. 데이터베이스 스키마 (요약, 상세는 BACKEND-INTEGRATED.md 2장)

| 테이블 | 용도 |
|---|---|
| `auth.users` | Supabase Auth 기본 제공 |
| `user_profiles` | 건강관리 목표(goal, daily_calorie_target) |
| `user_preferences` | 수량 관리 사용 여부, 유통기한 알림 여부 등 환경설정 |
| `ingredients_master` | 검색용 재료 마스터 DB (동의어, 기본 조미료 여부, 기본 유통기한) |
| `user_fridge` | 사용자별 보유 재료 (마스터 재료 또는 커스텀 재료, 보유 여부, 유통기한) |
| `recipes` | CSV 적재 결과 (재료 원문, 정규화된 재료 배열, 조리 순서, 영양정보) |
| `user_favorites` | 즐겨찾기 |
| `recipe_views` | 최근 조회 기록 |
| `recipe_completions` | "이 요리 완성했어요" 기록 |
| `ingredient_consumption_log` | 재료 소진 이력 (통계용) |

**모든 사용자별 테이블에는 Row-Level Security(RLS)를 반드시 적용**하고, `auth.uid() = user_id` 조건으로 본인 데이터만 접근 가능하게 합니다. (BACKEND-INTEGRATED.md 2.10 참고)

---

## 5. 핵심 기능 (요약, 상세는 PRD_.md 3장 F1~F20)

**MVP(P0)**: 회원가입/로그인, 검색 기반 재료 등록(부분 문자열 매칭 + 직접 추가), 나의 냉장고, 기본 조미료 자동 처리, 레시피 추천 대시보드/필터, 재료 매칭, 레시피 상세, 플랫폼별 네비게이션(웹 상단/모바일 하단)

**P1**: 유통기한 관리, 레시피 완성 처리(재료 자동 차감), 즐겨찾기, 최근 조회, 마이페이지 통계, 영양 정보 표시, 하루 섭취량 트래킹

**P2**: 목표 기반 맞춤 식단 필터, 영수증 OCR(보류 중), 바코드 스캔, 네이티브 앱 전환

> 레시피 추천은 **규칙 기반 문자열/동의어 매칭**입니다. "AI 기반 추천"이라는 표현은 쓰지 않습니다 — 실제로는 ML 모델이 아니라 결정적 매칭 로직이라 표현이 과장되면 안 됩니다.

---

## 6. 재료명 정규화 파이프라인 (CSV 적재 스크립트 작성 시 필수 참고)

`scripts/import-recipes.ts` 같은 적재 스크립트를 작성할 때, CSV의 비정형 재료 텍스트를 아래 순서로 정규화합니다 (BACKEND-INTEGRATED.md 3.1 상세 참고):

1. 특수문자 제거 → 2. 띄어쓰기 정규화 → 3. 수량/단위 라벨 제거 → 4. 보존할 수식어 추출("다진", "말린") → 5. 제거할 수식어 처리("구운", "삶은") → 6. 중복 단어 제거 → 7. 후행 단어 정렬("멸치육수" 등) → 8. `ingredients_master.synonyms` 기준 동의어 통합

완벽한 자동화보다는 "이 단계로도 매칭 안 되는 재료는 수동으로 synonyms에 추가"하는 반복 개선 방식을 씁니다.

---

## 7. 파일/폴더 구조 (Next.js App Router 기준 예시)

```
project-root/
├── app/
│   ├── fridge/              # 나의 냉장고 화면
│   ├── recipes/             # 레시피 추천 화면
│   ├── mypage/               # 마이페이지
│   └── api/
│       ├── fridge/
│       ├── ingredients/search/
│       ├── recipes/
│       └── mypage/summary/
├── components/                # FRONTEND.md 6장 컴포넌트 목록 참고
├── lib/
│   └── supabase/              # Supabase 클라이언트/세션 유틸
├── scripts/
│   └── import-recipes.ts      # CSV → recipes 테이블 1회 적재 스크립트
├── .env.local                 # Supabase 키 (Git 제외 필수)
├── .gitignore
├── PRD_.md
├── BACKEND-INTEGRATED.md
├── FRONTEND.md
├── UI-UX-Guideline.md
└── CLAUDE.md                  # 이 파일
```

---

## 8. 코딩 규칙

### 8.1 변수명/함수명
- 한글 주석은 괜찮지만 코드(변수명, 함수명)는 영문으로 작성
- 의도가 드러나는 이름 사용
  ```typescript
  // ✅ Good
  const ingredientSynonyms = {...};
  function normalizeIngredient(name: string): string {...}

  // ❌ Avoid
  const syns = {...};
  function norm(n: string) {...}
  ```

### 8.2 컴포넌트/함수 구성
- 한 컴포넌트/함수 = 한 가지 책임
- FRONTEND.md 6장에 정의된 컴포넌트 이름을 그대로 사용 (`FridgeCategorySection`, `RecipeCard` 등)

### 8.3 주석
- WHAT이 아니라 WHY를 설명
  ```typescript
  // ✅ Good
  // 기본 조미료는 사용자가 등록하지 않아도 항상 보유로 간주해서 매칭 누락을 막음
  if (ingredient.is_basic_seasoning) return true;

  // ❌ Avoid
  // is_basic_seasoning이 true면 true 반환
  ```

### 8.4 성능
- 재료 검색: DB 인덱스 기반 `ILIKE` 쿼리 또는 (소규모일 때) 프론트 캐싱 + 클라이언트 필터링
- 레시피 매칭: API Route 내 Set 기반 비교(O(n)) — 데이터 규모가 커지기 전까지는 충분

---

## 9. 보안 (BACKEND-INTEGRATED.md 6장 필수 준수)

- API 키/Supabase 서비스 롤 키는 환경변수로만 관리, 코드에 하드코딩 금지
- 비밀번호는 어떤 형태로도 클라이언트(localStorage 포함)에 저장하지 않음 — Supabase Auth 세션 토큰만 저장
- 모든 사용자별 테이블에 RLS 적용 (4장 표 참고)
- 통신은 HTTPS 기준

---

## 10. 테스트 체크리스트

### 기능 테스트
- [ ] 회원가입/로그인 (Supabase Auth만, 로컬 폴백 없음)
- [ ] 재료 검색 (부분 문자열 매칭 — "파" 검색 시 양파/대파/실파 등 노출 확인)
- [ ] 검색 결과 없어도 "직접 추가하기"로 커스텀 재료 등록 가능한지
- [ ] 기본 조미료 자동 처리 (미등록 상태에서도 매칭에 누락되지 않는지)
- [ ] 레시피 추천 필터(전체/완전 보유/일부 부족)
- [ ] 레시피 완성 처리 시 재료 자동 차감 + 통계 반영
- [ ] 즐겨찾기/최근 조회가 마이페이지에 정확히 반영되는지
- [ ] RLS로 다른 사용자 데이터 접근이 차단되는지

### 브라우저/반응형
- Chrome/Edge/Safari 최신 버전
- 모바일(하단 탭) / 데스크톱(상단 네비게이션) 레이아웃 전환 확인

---

## 11. 배포 체크리스트 (BACKEND-INTEGRATED.md 7.1과 동일)

- [ ] 환경변수 Vercel에 등록 (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] 전 테이블 RLS 정책 적용 확인
- [ ] Supabase CORS 정책 확인
- [ ] CSV 적재 스크립트 1회 실행 및 결과 검증 (자동 동기화 없음, 갱신 필요 시 수동 재실행)
- [ ] API 키 하드코딩 여부 확인
- [ ] HTTPS 적용 확인

---

## 12. 주의사항

1. **범위 밖 기능 임의 구현 금지**: 영수증 OCR, 의학적 식이 제한 추천은 PRD_.md에서 명시적으로 보류/제외됨 — 요청 없이 구현하지 않음
2. **디자인은 UI-UX-Guideline.md 그대로 따름**: 색상은 Steel Blue 단일 계열 + 아이스 그레이 뉴트럴. 상태 구분에 새로운 색을 추가하지 말고 채움/윤곽선/톤 농도로 표현
3. **CSV 재적재는 수동**: CSV 파일이 갱신돼도 자동 반영되지 않으므로, 데이터 갱신이 필요하면 적재 스크립트를 다시 실행해야 함을 잊지 말 것
4. **API 요청/응답 스키마**: BACKEND-INTEGRATED.md 5장 표 수준까지만 정의되어 있으므로, 구현 중 세부 필드가 필요하면 프론트와 협의해 확정

---

**마지막 수정**: 2026-07-16
**버전**: 2.0 (기존 Vanilla JS/localStorage 기준 문서를 Next.js/Supabase 기준으로 전면 교체)
