# BACKEND.md: 냉장고 재료 기반 레시피 추천 서비스 — 백엔드 명세

- 문서 버전: v2.0
- 작성일: 2026-07-16 (v1.0) / 갱신일: 2026-07-16 (v2.0, Backend-Guideline.md 검토 내용 통합)
- 기준 문서: PRD.md (변경 없음), UI-UX-Guideline.md
- 통합 이력: Backend-Guideline.md(별도 검토 문서)의 내용 중 본 문서와 상충하지 않는 항목(RLS, 사용자 환경설정, 정규화 파이프라인, 보안/에러처리/테스트/배포 체크리스트)을 흡수함. 상충 항목(로컬 스토리지 기반 저장, 클라이언트 런타임 CSV 로드, 로컬 인증 폴백)은 본 문서의 기존 방향을 그대로 유지함 — 상세 내용은 이 문서 맨 뒤 "10. 문서 통합 시 상충 사항 및 해결 방향" 참고.

> 이 문서는 PRD.md에서 정한 방향을 실제 구현 가능한 수준으로 구체화한 것입니다. 코드베이스는 Next.js 풀스택(App Router)이며, 여기서 "백엔드"는 Next.js API Route + Supabase(Postgres/Auth) 영역을 의미합니다. 별도 서버를 분리 배포하지 않습니다.

---

## 1. 아키텍처 개요

```
[클라이언트: Next.js 프론트]
        ↓ (fetch, 같은 프로젝트 내 API 호출)
[Next.js API Route]  ← 이 문서가 다루는 "백엔드"
        ↓
[Supabase: Auth / Postgres]
```

- 별도 백엔드 서버(Express, NestJS 등)를 두지 않고, Next.js API Route가 백엔드 역할을 겸함
- 식약처 레시피 데이터는 **실시간 API 호출이 아니라 CSV 파일을 1회성으로 DB에 적재**하는 방식으로 확정 (아래 3장 참고)

---

## 2. 데이터베이스 스키마

### 2.1 users
Supabase Auth가 기본 제공하는 테이블을 그대로 사용. 별도 커스텀 필드가 필요하면 `user_profiles`에 분리.

### 2.2 user_profiles (건강관리 기능용, P1~P2)
| 필드 | 타입 | 설명 |
|---|---|---|
| user_id | uuid (PK, FK → auth.users.id) | |
| goal | text (nullable) | 'diet' \| 'bulk' \| 'maintain' 등 일반 목표. 의학적 식이 제한은 다루지 않음 |
| daily_calorie_target | integer (nullable) | 목표 기반 필터/트래킹에 사용 |

> 가정: 의료적 식이 제한(당뇨, 신장질환 등)은 서비스 범위 밖으로 명시적으로 제외하고, UI에도 "참고용 정보이며 전문가 상담을 대체하지 않음" 문구를 넣는 것으로 가정함.

### 2.2-1 user_preferences (환경설정, Backend-Guideline.md 검토 후 추가)
| 필드 | 타입 | 설명 |
|---|---|---|
| user_id | uuid (PK, FK → auth.users.id) | |
| quantity_tracking_enabled | boolean (default true) | 재료 개수 관리 기능 사용 여부 (마이페이지 설정의 "수량 관리 사용" 토글과 연결) |
| expiry_notification_enabled | boolean (default true) | 유통기한 임박 알림 사용 여부 |
| default_category | text (nullable) | 재료 추가 시 기본으로 선택될 카테고리 (선택 기능) |

> 통합 메모: Backend-Guideline.md가 제안한 `user_preferences`(default_category, auto_add_basics) 개념은 유용하다고 판단해 흡수하되, 실제 필드는 최근 논의된 기능(수량 관리 토글, 유통기한 알림 토글)에 맞게 재구성함. `auto_add_basics`는 이미 `ingredients_master.is_basic_seasoning` 자동 처리 로직으로 대체되므로 별도 필드로 두지 않음.

### 2.3 ingredients_master (사전 등록된 식재료 검색 DB)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| name | text | 재료명 |
| category | text | 육류/채소/유제품/조미료 등 |
| synonyms | text[] | 동의어 목록, 레시피 매칭용 |
| is_basic_seasoning | boolean | 기본 조미료 여부. true면 사용자가 등록 안 해도 매칭 시 항상 보유로 간주 |
| default_shelf_life_days | integer (nullable) | 카테고리 기반 기본 유통기한 자동 제안용 |

### 2.4 user_fridge (사용자별 보유 재료)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK → auth.users.id) | |
| ingredient_id | uuid (FK → ingredients_master.id, nullable) | 마스터 DB에 있는 재료일 경우 |
| custom_name | text (nullable) | 검색 결과에 없어 사용자가 직접 입력한 재료명. `ingredient_id`가 null일 때만 값 존재 |
| is_owned | boolean | 보유 여부 |
| expiry_date | date (nullable) | 사용자가 직접 입력, 미입력 시 null |
| updated_at | timestamp | |

> 가정: 커스텀 재료는 우선 사용자 개인 스코프(`custom_name`)로만 저장하고, `ingredients_master`에는 자동으로 승격되지 않음. 추후 관리자가 검토 후 마스터 DB로 승격하는 프로세스는 이번 범위에 포함하지 않음(차기 검토).

### 2.5 recipes (CSV 적재 결과)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | text (PK) | 원본 데이터셋의 레시피 고유 ID |
| name | text | 요리명 |
| raw_ingredients_text | text | CSV 원본 재료 텍스트 (비정형) |
| parsed_ingredients | jsonb | 파싱/정규화 후 재료명 배열 |
| cooking_steps | jsonb | 조리 순서 배열 |
| image_url | text (nullable) | |
| category | text (nullable) | 한식/양식/중식 등 (있는 경우) |
| nutrition_kcal | numeric (nullable) | 1인분 기준 칼로리 |
| nutrition_carb | numeric (nullable) | 탄수화물(g) |
| nutrition_protein | numeric (nullable) | 단백질(g) |
| nutrition_fat | numeric (nullable) | 지방(g) |
| nutrition_sodium | numeric (nullable) | 나트륨(mg) |
| imported_at | timestamp | CSV 적재 시각 |

> 가정: CSV 원본에 영양성분 필드가 포함되어 있다고 가정하고 컬럼을 미리 마련함. 실제 CSV 컬럼명 확인 후 매핑 스크립트에서 조정 필요.

### 2.6 user_favorites (즐겨찾기)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| recipe_id | text (FK → recipes.id) | |
| created_at | timestamp | |

### 2.7 recipe_views (최근 조회)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| recipe_id | text (FK → recipes.id) | |
| viewed_at | timestamp | |

- 조회 API 호출 시 `(user_id, recipe_id)` unique 제약으로 upsert, `viewed_at`만 갱신 → 같은 레시피 여러 번 봐도 목록에 중복 없이 최신순 유지
- 마이페이지 "최근 조회한 요리"는 `viewed_at desc limit 5` 조회

### 2.8 recipe_completions ("이 요리 완성했어요" 기록)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| recipe_id | text (FK → recipes.id) | |
| completed_at | timestamp | |

- 완성 버튼 클릭 시 1행 insert
- "자주 만든 요리 TOP 3" 통계는 `recipe_id`별 `count(*)` 집계

### 2.9 ingredient_consumption_log (재료 소진 이력)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| ingredient_name | text | 소진된 재료명 (레시피 have 목록 기준) |
| consumed_at | timestamp | |

- 완성 버튼 클릭 시, 해당 레시피의 `parsed_ingredients` 중 사용자가 보유했던 재료 각각에 대해 1행씩 insert
- "자주 소진되는 재료 TOP 3"는 `ingredient_name`별 `count(*)` 집계

---

## 2.10 Row-Level Security (RLS) — Backend-Guideline.md 검토 후 신규 추가

Supabase 사용 시 반드시 활성화해야 하는 부분인데 기존 문서에 누락되어 있었음. 사용자별 데이터 테이블(`user_fridge`, `user_favorites`, `recipe_views`, `recipe_completions`, `ingredient_consumption_log`, `user_profiles`, `user_preferences`)에는 모두 RLS를 걸어 본인 데이터만 조회/수정 가능하도록 함.

```sql
ALTER TABLE user_fridge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fridge items"
  ON user_fridge FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own fridge items"
  ON user_fridge FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fridge items"
  ON user_fridge FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fridge items"
  ON user_fridge FOR DELETE
  USING (auth.uid() = user_id);
```

동일한 패턴을 `user_favorites`, `recipe_views`, `recipe_completions`, `ingredient_consumption_log`, `user_profiles`, `user_preferences`에도 반복 적용. `ingredients_master`, `recipes`는 공용 조회 데이터이므로 SELECT는 전체 허용, INSERT/UPDATE/DELETE는 서비스 역할(관리자/적재 스크립트)만 가능하도록 제한.

---

## 3. 데이터 적재 (CSV → DB, 1회성)

- 식약처 레시피 공공데이터를 **CSV로 다운로드 후, 별도 적재 스크립트(`scripts/import-recipes.ts` 등)를 실행해 `recipes` 테이블에 insert**
- **실시간/주기적 자동 동기화는 하지 않음** — CSV 파일이 갱신되어도 자동 반영되지 않으며, 최신 데이터를 반영하려면 스크립트를 다시 수동 실행해야 함
- 적재 스크립트가 해야 할 일:
  1. CSV 파싱 (컬럼 매핑 확인 필수 — 실제 파일 컬럼명은 다운로드 후 확인)
  2. `raw_ingredients_text`에서 재료명만 추출해 `parsed_ingredients`(배열)로 정규화
  3. `ingredients_master.synonyms`를 참고해 재료명 표준화 시도 (완전 자동 매칭은 어려우므로 부분 문자열 포함 여부로 우선 처리)
  4. Supabase에 upsert (재실행 시 중복 방지를 위해 레시피 고유 ID 기준 upsert)

### 3.1 재료명 정규화 파이프라인 상세 (Backend-Guideline.md 검토 후 보강)

CSV의 `raw_ingredients_text`는 "돼지고기 200g, 다진 마늘 1큰술, 저염간장 2큰술"처럼 비정형 텍스트라, 아래 단계를 거쳐 `parsed_ingredients` 배열로 정규화하는 것을 권장:

```
원본 재료 텍스트
  ↓
1) 특수문자 제거 (쉼표, 괄호 등 구분자만 남기고 정리)
  ↓
2) 띄어쓰기 정규화
  ↓
3) 수량/단위 라벨 제거 ("200g", "1큰술", "적당량" 등)
  ↓
4) 보존할 수식어 추출 ("다진", "말린" 등 재료 식별에 의미 있는 수식어는 유지)
  ↓
5) 제거할 수식어 처리 ("구운", "삶은" 등 조리법 수식어는 재료명 매칭에는 불필요하므로 제거 검토)
  ↓
6) 중복 단어 제거
  ↓
7) 후행 단어 정렬 ("멸치육수", "다시마육수"처럼 뒤에 공통 단어가 붙는 경우 일관되게 정리)
  ↓
8) ingredients_master.synonyms 기준 동의어 통합
  ↓
최종 정규화된 재료명 (parsed_ingredients 배열의 원소)
```

> 통합 메모: 이 파이프라인은 Backend-Guideline.md에서 제안된 단계를 그대로 가져온 것으로, 실제 적재 스크립트 작성 시 참고용 체크리스트로 활용. 완벽한 자동화보다는 "이 단계들을 거쳤는데도 매칭이 안 되는 재료는 수동으로 synonyms에 추가"하는 반복 개선 방식을 권장.

---

## 4. 핵심 비즈니스 로직

### 4.1 재료 검색 (부분 문자열 매칭)
- 사용자가 검색창에 입력한 문자열이 재료명 **어디에 포함되든** 매칭 (`ILIKE '%검색어%'` 또는 동등한 부분 문자열 검색)
- 예: "파" 검색 시 양파/대파/실파/쪽파/파슬리/파프리카가 모두 노출
- MVP 규모(재료 마스터 DB가 크지 않음)에서는 프론트에서 전체 목록을 캐싱해두고 클라이언트 필터링도 가능. 데이터가 커지면 백엔드 `ILIKE` 쿼리로 전환
- 검색 결과 유무와 무관하게, 사용자가 입력한 검색어 그대로 "직접 추가하기" 옵션을 항상 제공 → `user_fridge.custom_name`으로 저장

### 4.2 조미료 자동 처리
- `ingredients_master.is_basic_seasoning = true`인 재료는 사용자가 `user_fridge`에 등록하지 않아도 매칭 시 항상 "보유"로 간주
- 매칭 계산 시: 레시피 필요 재료 목록에서 이 재료들은 애초에 "확인 대상"에서 제외

### 4.3 레시피 매칭 (일치/불일치 계산)
1. 레시피의 `parsed_ingredients`를 순회
2. 각 재료가 `is_basic_seasoning`이면 무조건 "보유"로 처리
3. 그 외 재료는 `user_fridge`에서 `is_owned = true`인 항목과 이름/동의어 비교(부분 문자열 포함 매칭 우선)
4. 전부 보유 → "완전 매칭", 일부만 보유 → "일부 부족"(부족 재료 목록 함께 반환), 하나도 없으면 추천 대상에서 제외 가능(정책 확인 필요)

**의사코드 예시** (Backend-Guideline.md의 클라이언트 매칭 로직을 서버 사이드 API Route 기준으로 재구성):
```javascript
function matchRecipes(recipes, ownedIngredientNames, basicSeasoningNames) {
  const owned = new Set(ownedIngredientNames.map(n => n.toLowerCase()));
  const basics = new Set(basicSeasoningNames.map(n => n.toLowerCase()));

  return recipes.map(recipe => {
    const missing = recipe.parsed_ingredients.filter(ing => {
      const lower = ing.toLowerCase();
      if (basics.has(lower)) return false; // 기본 조미료는 항상 보유로 간주
      return !owned.has(lower);
    });

    return {
      ...recipe,
      missing,
      status: missing.length === 0 ? 'full' : 'partial',
    };
  }).sort((a, b) => {
    if (a.status !== b.status) return a.status === 'full' ? -1 : 1;
    return a.missing.length - b.missing.length;
  });
}
```
이 로직은 Next.js API Route(`GET /api/recipes`) 안에서 실행하며, 클라이언트는 결과만 받아 렌더링.

### 4.4 레시피 완성 처리 ("이 요리 완성했어요")
1. `recipe_completions`에 1행 insert
2. 레시피의 `parsed_ingredients` 중 사용자가 보유하고 있던 재료들을 `user_fridge.is_owned = false`로 업데이트 (자동 차감)
3. 각 소진 재료에 대해 `ingredient_consumption_log`에 1행씩 insert

### 4.5 유통기한 처리
- 재료 등록 시 `ingredients_master.default_shelf_life_days`를 참고해 `expiry_date` 기본값을 자동 계산해 제안(오늘 날짜 + 기본 일수), 사용자가 수정 가능
- "나의 냉장고" 화면 조회 API는 `expiry_date`가 가까운 순으로 정렬 옵션 제공
- 레시피 추천 API는 유통기한 임박 재료를 포함하는 레시피에 가중치를 부여하는 옵션 파라미터 지원 (P1)

### 4.6 마이페이지 통계
- "최근 조회한 요리": `recipe_views` 최신순 5개
- "즐겨찾기한 요리": `user_favorites` 전체
- "자주 만든 요리 TOP 3": `recipe_completions`를 `recipe_id`로 그룹핑 후 count 내림차순 3개
- "자주 소진된 재료 TOP 3": `ingredient_consumption_log`를 `ingredient_name`으로 그룹핑 후 count 내림차순 3개

---

## 5. API 엔드포인트 명세 (Next.js API Route 기준)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | /api/ingredients/search?q={query} | 부분 문자열 매칭으로 재료 검색 | 필요 |
| GET | /api/fridge | 내 냉장고 목록 조회 (카테고리별) | 필요 |
| POST | /api/fridge | 재료 추가 (마스터 재료 또는 커스텀 재료) | 필요 |
| PATCH | /api/fridge/:id | 보유 여부, 유통기한 수정 | 필요 |
| DELETE | /api/fridge/:id | 재료 삭제 | 필요 |
| GET | /api/recipes?filter={all\|full\|partial} | 레시피 추천 목록 (매칭 결과 포함) | 필요 |
| GET | /api/recipes/:id | 레시피 상세 (매칭 결과 + 영양정보 포함) | 필요 |
| POST | /api/recipes/:id/view | 조회 기록 남기기 (upsert) | 필요 |
| POST | /api/recipes/:id/favorite | 즐겨찾기 추가 | 필요 |
| DELETE | /api/recipes/:id/favorite | 즐겨찾기 해제 | 필요 |
| POST | /api/recipes/:id/complete | 완성 처리 (재료 차감 + 통계 기록) | 필요 |
| GET | /api/mypage/summary | 최근 조회/즐겨찾기/통계 요약 | 필요 |

> 가정: 요청/응답 상세 스키마(필드명, 타입)는 이 표 수준까지만 정의하고, 실제 구현 단계에서 프론트와 함께 최종 확정하는 것으로 가정함. 별도 API_CONTRACT 문서는 이번 범위에서는 생략(엔드포인트 수가 적어 이 표로 충분하다고 판단).

---

## 6. 인증 및 보안

### 6.1 인증
- Supabase Auth (이메일 기반) 사용
- Next.js API Route에서 Supabase 세션을 서버 사이드에서 검증 (`@supabase/ssr` 활용)
- 모든 API는 로그인 사용자 기준으로 동작 (비로그인 접근 차단)
- **로컬 인증 폴백(비밀번호를 브라우저에 base64 등으로 저장)은 채택하지 않음** — Backend-Guideline.md에 제안되어 있었으나, 비밀번호를 평문에 가깝게 클라이언트에 저장하는 방식은 보안 원칙에 위배되어 배제. Supabase가 네트워크 오류로 응답하지 않는 경우에는 "잠시 후 다시 시도해주세요" 안내와 재시도만 제공

### 6.2 비밀번호 정책
- Supabase Auth 기본 정책 사용 (최소 6자 이상)
- 별도 복잡도 요구사항은 MVP 단계에서 추가하지 않음

### 6.3 민감 정보 관리
- API 키, Supabase 서비스 롤 키 등은 반드시 환경변수(`.env`, Vercel 환경변수)로 관리하고 코드에 하드코딩하지 않음
- 비밀번호는 클라이언트에 어떤 형태로도 저장하지 않음 (Supabase Auth 세션 토큰만 저장)
- 모든 통신은 HTTPS 기준

### 6.4 에러 처리
- 로그인 실패 시 원인별 사용자 안내 메시지 분리 (예: 잘못된 자격 증명 / 이메일 미인증 / 일시적 오류)
- CSV 적재 실패, 레시피 데이터 없음 등 데이터 이슈는 사용자에게 "레시피 데이터를 불러오지 못했습니다" 같은 명확한 안내와 함께 개발자 로그(콘솔 또는 모니터링 도구)에 상세 원인 기록

---

## 7. 배포/운영

- Vercel 배포 (Next.js 프로젝트와 함께)
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`(서버 전용, CSV 적재 스크립트용)
- CSV 적재 스크립트는 로컬 또는 별도 배치 환경에서 수동 실행 (Vercel 배포 파이프라인에는 포함하지 않음)

### 7.1 배포 전 체크리스트 (Backend-Guideline.md 검토 후 보강)
- [ ] 환경변수 Vercel에 등록 완료
- [ ] Supabase RLS 정책 전 테이블 적용 확인 (2.10 참고)
- [ ] Supabase CORS 정책 확인
- [ ] 이메일 인증 사용 여부 결정 및 설정
- [ ] API 키 등 민감 정보 코드에 하드코딩되어 있지 않은지 확인
- [ ] HTTPS 정상 적용 확인
- [ ] 레시피 CSV 적재 스크립트 1회 실행 및 결과 검증

---

## 8. 테스트 전략 (Backend-Guideline.md 검토 후 신규 추가)

### 8.1 단위 테스트
- 재료명 정규화 함수: "다진 마늘" → "다진마늘", "저염간장" → "간장"(동의어 통합) 등 케이스별 검증
- 레시피 매칭 함수: 보유 재료 조합에 따라 `full`/`partial` 상태와 부족 재료 목록이 정확히 나오는지 검증

### 8.2 통합 테스트
- 회원가입 → 재료 등록(검색/커스텀) → 레시피 추천 → 완성 처리 → 마이페이지 통계 반영까지 이어지는 흐름 전체 검증
- RLS 정책이 실제로 타 사용자 데이터 접근을 차단하는지 검증 (다른 계정으로 조회 시 빈 결과 확인)

---

## 9. 범위 밖으로 확정된 항목 (참고용)

- **영수증 텍스트 인식(OCR)**: Naver Clova OCR 검토했으나, 비용 불확실성과 개발 복잡도 대비 MVP 핵심 가치 기여도가 낮다고 판단하여 P2로 유지, 별도 착수 시점 미정
- **의학적 식이 제한 기반 추천**: 서비스 범위에서 명시적으로 제외 (일반 목표 기반 필터만 지원)

---

## 10. 문서 통합 시 상충 사항 및 해결 방향

본 문서(v2.0)는 별도로 검토된 Backend-Guideline.md의 내용을 참고해 통합한 결과입니다. 두 문서가 상충한 지점과 채택 근거는 다음과 같습니다.

| 항목 | 본 문서(BACKEND.md, 기준) | Backend-Guideline.md | 채택 및 근거 |
|---|---|---|---|
| 냉장고 데이터 저장 위치 | Supabase `user_fridge` 테이블 | 브라우저 localStorage | 본 문서 채택. localStorage는 기기 변경/브라우저 데이터 삭제 시 유실되고 기기 간 동기화 불가 |
| 레시피 데이터 로드 방식 | CSV를 서버에서 1회 적재해 `recipes` 테이블로 관리 | 클라이언트가 매 세션 CSV를 fetch해 런타임 파싱 | 본 문서 채택. 매번 파싱은 성능/일관성 면에서 불리하고, 여러 사용자가 같은 데이터를 참조하는 구조에 맞지 않음 |
| 재료 마스터 DB | Supabase `ingredients_master` 테이블 | 클라이언트 메모리 Map, DB 미구현 | 본 문서 채택. 서버에서 관리해야 검색/동의어 매칭을 여러 클라이언트가 일관되게 사용 가능 |
| 인증 실패 시 로컬 폴백 | 없음 (Supabase Auth 단일 경로) | 비밀번호를 base64로 localStorage에 저장하는 로컬 인증 폴백 | 채택하지 않음. 비밀번호를 클라이언트에 노출 가능한 형태로 저장하는 것은 보안 원칙에 위배됨 |
| Row-Level Security | 미기재 | 정책 예시 제공 | Backend-Guideline.md 내용 흡수 (2.10) |
| 사용자 환경설정 테이블 | 없음 | `user_preferences`(default_category, auto_add_basics) | 개념은 흡수하되 필드는 최근 논의(수량 관리 토글, 유통기한 알림 토글)에 맞게 재구성 |
| 재료명 정규화 파이프라인 | 개략적 서술 | 8단계 상세 파이프라인 | Backend-Guideline.md 내용 흡수 (3.1) |
| 보안/에러처리/테스트/배포 체크리스트 | 간략 | 상세 | Backend-Guideline.md 내용 흡수 (6.2~6.4, 7.1, 8장) |

> 이 섹션은 통합 과정의 의사결정 근거를 남기기 위한 것으로, 실제 구현 시 참고 문서(Backend-Guideline.md)를 다시 확인할 필요는 없습니다.
