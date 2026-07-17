# BACKEND-INTEGRATED.md: 냉장고 재료 기반 레시피 추천 서비스 — 백엔드 명세

- 문서 버전: v2.6
- 작성일: 2026-07-16 (v1.0) / 갱신일: 2026-07-16 (v2.0 Backend-Guideline.md 통합, v2.1 실제 CSV(`food_recipes_data_fin.csv`) 검토 결과 반영) / 2026-07-17 (v2.2 이미지 URL 폴백 순서 구체화, v2.3 최신 실무 관행 보강, v2.4 문서 정합성 재검증, v2.5 재검증 2회차, v2.6 재검증 3회차)
- v2.6 변경 사항: 2.6의 `category` 필드 설명이 "한식/양식/중식 등"으로 되어 있어 3.0(`RCP_PAT2` 매핑, 반찬/일품/후식/밥/국&찌개/기타 6종 고정값) 및 PRD.md/FRONTEND.md의 서술과 어긋나던 자기모순 수정 — 3.0 기준으로 통일
- v2.5 변경 사항: 상단 인용구·4.3·CLAUDE.md 8.4가 "API Route에서 실행"이라고 서술해 5장(Server Component 기준)과 어긋나던 부분 수정, 10장의 "본 문서(v2.1)" 버전 자기참조 오류 수정, FRONTEND.md 2.1/2.2의 `POST /api/...` 리터럴 표기를 Server Action 기준으로 통일
- v2.3 변경 사항: 검색 성능(pg_trgm 인덱스), 이미지 mixed-content 관련 설명 정정(next/image 동작 방식), 타입 안전성(Supabase 타입 생성)·스키마 마이그레이션 관리, 테스트 도구(Vitest/Playwright) 구체화
- v2.4 변경 사항: 아키텍처 개요/5장/6.1을 Server Component·Server Action 기준으로 재정렬(FRONTEND.md·CLAUDE.md와 모순 제거), "2.10 RLS"의 헤딩 레벨 오류(##→###) 수정 및 2.2-1 등 비표준 하위 번호를 2.3~2.11로 순차 정리, 관련 상호 참조(CLAUDE.md 포함) 전부 갱신
- 기준 문서: PRD_.md (변경 없음), UI-UX-Guideline.md
- 통합 이력: Backend-Guideline.md(별도 검토 문서)의 내용 중 본 문서와 상충하지 않는 항목(RLS, 사용자 환경설정, 정규화 파이프라인, 보안/에러처리/테스트/배포 체크리스트)을 흡수함. 상충 항목(로컬 스토리지 기반 저장, 클라이언트 런타임 CSV 로드, 로컬 인증 폴백)은 본 문서의 기존 방향을 그대로 유지함 — 상세 내용은 이 문서 맨 뒤 "10. 문서 통합 시 상충 사항 및 해결 방향" 참고.
- v2.1 변경 사항: 실제 레시피 CSV 파일을 직접 검토해 컬럼 매핑(3.0), 정규화 파이프라인(3.1) 축소·구체화, 실데이터 기반 예외 처리 목록(3.2)을 추가함

> 이 문서는 PRD_.md에서 정한 방향을 실제 구현 가능한 수준으로 구체화한 것입니다. 코드베이스는 Next.js 풀스택(App Router)이며, 여기서 "백엔드"는 Next.js의 Server Component(조회) + Server Action(변경) + 필요시 API Route(클라이언트 재검증용) + Supabase(Postgres/Auth) 영역을 의미합니다. 별도 서버를 분리 배포하지 않습니다.

---

## 1. 아키텍처 개요

```
[초기 조회] Server Component → Supabase 직접 조회 → 서버 렌더링 결과 전달
[변경 작업] 클라이언트 인터랙션 → Server Action → Supabase 세션 검증 → DB 갱신
[클라이언트 재검증이 꼭 필요한 경우만] Next.js API Route (예: 타이핑마다 바뀌는 재료 검색)
        ↓ (위 세 경로 모두)
[Supabase: Auth / Postgres]
```

- 별도 백엔드 서버(Express, NestJS 등)를 두지 않음. "백엔드"는 Next.js의 **Server Component(조회) + Server Action(변경) + 필요시 API Route(클라이언트 재검증용)**를 합쳐 의미함 — FRONTEND.md 3장, CLAUDE.md 3.1과 동일한 기준
- 이 문서의 5장 "API 엔드포인트 명세" 표는 실제 구현 형태(API Route vs Server Action)와 무관하게 **필요한 기능 단위**를 정리한 것으로 읽으면 됨. 초기 조회 성격은 Server Component, 변경 작업은 Server Action으로 구현하는 것을 기본으로 하되, 팀이 원하면 표에 있는 그대로 REST API Route로 구현해도 동일하게 동작함
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

### 2.3 user_preferences (환경설정, Backend-Guideline.md 검토 후 추가)
| 필드 | 타입 | 설명 |
|---|---|---|
| user_id | uuid (PK, FK → auth.users.id) | |
| quantity_tracking_enabled | boolean (default true) | 재료 개수 관리 기능 사용 여부 (마이페이지 설정의 "수량 관리 사용" 토글과 연결) |
| expiry_notification_enabled | boolean (default true) | 유통기한 임박 알림 사용 여부 |
| default_category | text (nullable) | 재료 추가 시 기본으로 선택될 카테고리 (선택 기능) |

> 통합 메모: Backend-Guideline.md가 제안한 `user_preferences`(default_category, auto_add_basics) 개념은 유용하다고 판단해 흡수하되, 실제 필드는 최근 논의된 기능(수량 관리 토글, 유통기한 알림 토글)에 맞게 재구성함. `auto_add_basics`는 이미 `ingredients_master.is_basic_seasoning` 자동 처리 로직으로 대체되므로 별도 필드로 두지 않음.

### 2.4 ingredients_master (사전 등록된 식재료 검색 DB)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| name | text | 재료명 |
| category | text | 육류/채소/유제품/조미료 등 |
| synonyms | text[] | 동의어 목록, 레시피 매칭용 |
| is_basic_seasoning | boolean | 기본 조미료 여부. true면 사용자가 등록 안 해도 매칭 시 항상 보유로 간주 |
| default_shelf_life_days | integer (nullable) | 카테고리 기반 기본 유통기한 자동 제안용 |

### 2.5 user_fridge (사용자별 보유 재료)
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

### 2.6 recipes (CSV 적재 결과)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | text (PK) | 원본 데이터셋의 레시피 고유 ID (`RCP_SEQ`) |
| name | text | 요리명 |
| raw_ingredients_text | text | CSV 원본 재료 텍스트 (비정형) |
| parsed_ingredients | jsonb | 파싱/정규화 후 재료명 배열 |
| cooking_steps | jsonb | 조리 순서 배열 |
| image_url | text (nullable) | |
| category | text (nullable) | 반찬/일품/후식/밥/국&찌개/기타 (6종 고정값, 3.0 `RCP_PAT2` 매핑 참고) |
| cooking_method | text (nullable) | 조리법(굽기/끓이기/볶기/찌기/튀기기/기타) — 차기 조리법 필터 기능용 |
| nutrition_kcal | numeric (nullable) | 1인분 기준 칼로리 |
| nutrition_carb | numeric (nullable) | 탄수화물(g) |
| nutrition_protein | numeric (nullable) | 단백질(g) |
| nutrition_fat | numeric (nullable) | 지방(g) |
| nutrition_sodium | numeric (nullable) | 나트륨(mg) |
| imported_at | timestamp | CSV 적재 시각 |

> 가정 → 검증 완료: 실제 CSV(`food_recipes_data_fin.csv`, 1,143건) 확인 결과 영양성분 필드가 모두 존재함(`INFO_ENG/CAR/PRO/FAT/NA`). 컬럼 매핑 상세는 3.0 참고.

### 2.7 user_favorites (즐겨찾기)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| recipe_id | text (FK → recipes.id) | |
| created_at | timestamp | |

### 2.8 recipe_views (최근 조회)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| recipe_id | text (FK → recipes.id) | |
| viewed_at | timestamp | |

- 조회 API 호출 시 `(user_id, recipe_id)` unique 제약으로 upsert, `viewed_at`만 갱신 → 같은 레시피 여러 번 봐도 목록에 중복 없이 최신순 유지
- 마이페이지 "최근 조회한 요리"는 `viewed_at desc limit 5` 조회

### 2.9 recipe_completions ("이 요리 완성했어요" 기록)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| recipe_id | text (FK → recipes.id) | |
| completed_at | timestamp | |

- 완성 버튼 클릭 시 1행 insert
- "자주 만든 요리 TOP 3" 통계는 `recipe_id`별 `count(*)` 집계

### 2.10 ingredient_consumption_log (재료 소진 이력)
| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| ingredient_name | text | 소진된 재료명 (레시피 have 목록 기준) |
| consumed_at | timestamp | |

- 완성 버튼 클릭 시, 해당 레시피의 `parsed_ingredients` 중 사용자가 보유했던 재료 각각에 대해 1행씩 insert
- "자주 소진되는 재료 TOP 3"는 `ingredient_name`별 `count(*)` 집계

---

### 2.11 Row-Level Security (RLS) — Backend-Guideline.md 검토 후 신규 추가

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
  1. CSV 파싱 (실제 파일은 `food_recipes_data_fin.csv`, UTF-8-SIG 인코딩, 34개 컬럼, 1,143개 레코드로 확인됨 — 컬럼 매핑은 3.0 참고)
  2. **`RCP_PARTS`(이미 수량이 제거된 콤마 구분 재료명 목록)를 우선 활용**해 `parsed_ingredients`(배열)로 정규화 — `RCP_PARTS_DTLS`(수량 포함 원문)는 상세 화면 표시용 원문(`raw_ingredients_text`)으로만 보관
  3. `ingredients_master.synonyms`를 참고해 재료명 표준화 시도 (완전 자동 매칭은 어려우므로 부분 문자열 포함 여부로 우선 처리)
  4. Supabase에 upsert (재실행 시 중복 방지를 위해 `RCP_SEQ` 기준 upsert — 실제 데이터 확인 결과 중복 없음)

### 3.0 실제 CSV 컬럼 매핑 (`food_recipes_data_fin.csv` 검토 결과)

| CSV 컬럼 | `recipes` 테이블 필드 | 비고 |
|---|---|---|
| `RCP_SEQ` | `id` | 중복 없음 확인 (18~3691 범위, 1,143건) |
| `RCP_NM` | `name` | |
| `RCP_PARTS_DTLS` | `raw_ingredients_text` | 수량 포함 원문, 상세 화면 표시용 |
| `RCP_PARTS` | (정규화 소스, 별도 컬럼 아님) | 수량 없는 콤마 구분 재료명 — `parsed_ingredients` 생성에 우선 사용 |
| `MANUAL01~20` | `cooking_steps` | 빈 값은 제외하고 순서대로 배열에 담음 (레시피당 보통 5~10단계) |
| `ATT_FILE_NO_MAIN` | `image_url` | 우선 사용. 비어있으면 `ATT_FILE_NO_MK`로 대체, 둘 다 없으면 null → 프론트에서 플레이스홀더 표시 |
| `INFO_ENG/CAR/PRO/FAT/NA` | `nutrition_kcal/carb/protein/fat/sodium` | 전부 숫자, 결측 없음 |
| `RCP_PAT2` | `category` | 반찬/일품/후식/밥/국&찌개/기타 (6종 고정값) |
| `RCP_WAY2` | `cooking_method` (신규 필드, nullable) | 굽기/끓이기/볶기/찌기/튀기기/기타 (6종) — 조리법 필터 기능에 활용 가능 (차기) |

### 3.1 재료명 정규화 파이프라인 상세 (Backend-Guideline.md 검토 후 보강)

CSV의 `RCP_PARTS_DTLS`(원문)는 "돼지고기 200g, 다진 마늘 1큰술, 저염간장 2큰술"처럼 비정형 텍스트지만, **`RCP_PARTS` 컬럼이 이미 수량을 제거한 콤마 구분 목록을 제공**하므로 아래 파이프라인의 상당 부분(2~3단계)은 실제로는 생략 가능합니다. 다만 `RCP_PARTS`에도 아래 3.2의 예외 케이스가 남아있어 후처리가 필요합니다.

```
RCP_PARTS (콤마 구분 재료명 목록)
  ↓
1) 섹션 라벨 제거 (3.2 참고 — "고명", "양념", "소스" 등)
  ↓
2) 요리명 자기참조 항목 제거 (3.2 참고)
  ↓
3) 특수문자/공백 정규화
  ↓
4) 보존할 수식어 유지 ("다진", "말린" 등은 재료 식별에 의미 있어 유지)
  ↓
5) ingredients_master.synonyms 기준 동의어 통합 (예: "저염간장" → "간장")
  ↓
최종 정규화된 재료명 (parsed_ingredients 배열의 원소)
```

> 통합 메모: 원래 Backend-Guideline.md는 `RCP_PARTS_DTLS`(수량 포함 원문)를 정규화 대상으로 가정해 8단계 파이프라인을 제안했으나, 실제 CSV에 `RCP_PARTS`가 별도 제공됨을 확인하고 이를 우선 소스로 쓰도록 축소·재구성함. `RCP_PARTS_DTLS`는 그대로 `raw_ingredients_text`에 저장해 상세 화면에는 원문 그대로 노출.

### 3.2 실제 데이터 기반 예외 처리 (`food_recipes_data_fin.csv` 검토 결과)

CSV를 직접 검토한 결과 아래 예외들이 확인되어, 적재 스크립트에 반드시 반영해야 합니다.

1. **섹션 라벨 필터링**: `RCP_PARTS_DTLS` 안에 재료 섹션 구분("고명", "양념", "소스" 등)이 줄바꿈으로 섞여 있는 레시피가 1,143건 중 403건(35%). `RCP_PARTS`에도 이 라벨이 재료처럼 섞여 나오는 경우가 있어(예: "연두부, 칵테일새우, ..., 고명, 시금치"), 아래 키워드를 만나면 재료가 아니라 "구분 라벨"로 간주해 `parsed_ingredients`에서 제외:
   ```
   고명, 양념, 양념장, 소스, 드레싱, 토핑, 재료용, 반죽용, 찜용, 국물용
   ```
2. **요리명 자기참조 제거**: 일부 레시피(확인된 사례: "사과 새우 북엇국" → 첫 재료가 "북엇국", "저염 된장으로 맛을 낸 황태해장국" → 첫 재료가 "황태해장국")는 요리명 자체가 재료 목록에 그대로 포함되어 있음. `parsed_ingredients` 생성 시, 항목이 `RCP_NM`과 완전히 같거나 `RCP_NM`의 접미어(국/찌개/탕/전골 등으로 끝나는 부분)와 일치하면 제외
3. **중복 요리명 허용**: 이름이 같은 레시피가 7건 존재(예: "둥지튀김", "양배추롤" 등 각 2건). `id`(`RCP_SEQ`)가 다르므로 데이터 무결성 문제는 아니며, 검색/추천 결과에 동명 레시피가 2개 뜰 수 있음을 프론트에서 인지하고 있으면 됨 (별도 처리 불필요, UI에서는 카드가 2개 뜨는 게 정상 동작)
4. **조리 단계 말미 잔여 문자 제거**: `MANUAL01~04` 필드 중 극소수(전체의 0.1~0.5%, 약 5~6개 레시피)에서 문장 끝에 알파벳 한 글자가 붙어있는 스크래핑 잔재 발견(예: `"...건진다.a"`). 적재 시 정규식으로 제거 권장: 문장이 마침표(`.`) 뒤 알파벳 한 글자로 끝나면 그 알파벳만 잘라냄
5. **영양정보 0값 로그 남기기**: 칼로리 0인 레코드 1건, 지방 0인 레코드 21건 등 일부 0값이 존재. 실제로 저칼로리 음식일 수도, 원본 데이터 누락일 수도 있어 **적재 시 0값 레코드 목록을 로그로 남겨 수동 확인** (자동으로 제외하거나 수정하지 않음)
6. **이미지 URL 프로토콜**: 전체 이미지 URL이 `http://www.foodsafetykorea.go.kr/...` (HTTPS 아님). `<img src="http://...">`를 우리 HTTPS 페이지에 그대로 쓰면 브라우저 혼합 콘텐츠(mixed content) 경고/차단이 발생할 수 있음. **Next.js `next/image` 컴포넌트를 사용하면 이미지가 Next.js 서버를 거쳐 최적화·재서빙되므로 최종 사용자 브라우저 입장에서는 우리 도메인(HTTPS)에서 오는 이미지로 보여 혼합 콘텐츠 문제가 발생하지 않음** — 단, `next.config.js`의 `images.remotePatterns`에 `www.foodsafetykorea.go.kr`을 등록해야 함. 원본 서버가 느리거나 응답이 불안정할 가능성에 대비해, 트래픽이 늘어나면 ② 적재 시 이미지를 Supabase Storage로 복사해 자체 호스팅하는 방안도 차기 검토
7. **이미지 URL 폴백 순서**: `ATT_FILE_NO_MAIN`(A열)을 우선 사용하고, 비어있으면 `ATT_FILE_NO_MK`(B열)로 대체. 적재 스크립트에서 `image_url = ATT_FILE_NO_MAIN || ATT_FILE_NO_MK || null`로 계산해 저장. 둘 다 없는 경우(실측 2건)는 null로 두고 프론트에서 플레이스홀더 표시 (FRONTEND.md 카드 스펙의 회색 배경 처리로 충분)

> 이 예외 목록은 1회성 적재 스크립트 작성 시 그대로 테스트 케이스로 활용 가능 (8장 테스트 전략의 "재료명 정규화 함수" 단위 테스트에 위 5가지 케이스를 추가하는 것을 권장).

---

## 4. 핵심 비즈니스 로직

### 4.1 재료 검색 (부분 문자열 매칭)
- 사용자가 검색창에 입력한 문자열이 재료명 **어디에 포함되든** 매칭 (`ILIKE '%검색어%'` 또는 동등한 부분 문자열 검색)
- 예: "파" 검색 시 양파/대파/실파/쪽파/파슬리/파프리카가 모두 노출
- MVP 규모(재료 마스터 DB가 크지 않음)에서는 프론트에서 전체 목록을 캐싱해두고 클라이언트 필터링도 가능. 데이터가 커지면 백엔드 `ILIKE` 쿼리로 전환
- 검색 결과 유무와 무관하게, 사용자가 입력한 검색어 그대로 "직접 추가하기" 옵션을 항상 제공 → `user_fridge.custom_name`으로 저장

> **성능 보강 (신규)**: `ILIKE '%검색어%'`처럼 앞에 와일드카드가 붙는 검색은 일반 B-tree 인덱스를 못 타서 테이블이 커지면 느려짐. `ingredients_master.name`에 PostgreSQL `pg_trgm` 확장 기반 GIN 인덱스(`CREATE EXTENSION pg_trgm; CREATE INDEX ON ingredients_master USING gin (name gin_trgm_ops);`)를 걸어두면 재료 수가 수만 개로 늘어나도 검색 속도를 유지할 수 있음. MVP 단계에서 미리 인덱스만 걸어두고, 실제 체감 지연이 없다면 추가 튜닝은 보류.

### 4.2 조미료 자동 처리
- `ingredients_master.is_basic_seasoning = true`인 재료는 사용자가 `user_fridge`에 등록하지 않아도 매칭 시 항상 "보유"로 간주
- 매칭 계산 시: 레시피 필요 재료 목록에서 이 재료들은 애초에 "확인 대상"에서 제외

### 4.3 레시피 매칭 (일치/불일치 계산)
1. 레시피의 `parsed_ingredients`를 순회
2. 각 재료가 `is_basic_seasoning`이면 무조건 "보유"로 처리
3. 그 외 재료는 `user_fridge`에서 `is_owned = true`인 항목과 이름/동의어 비교(부분 문자열 포함 매칭 우선)
4. 전부 보유 → "완전 매칭", 일부만 보유 → "일부 부족"(부족 재료 목록 함께 반환), 하나도 없으면 추천 대상에서 제외 가능(정책 확인 필요)

**의사코드 예시** (Backend-Guideline.md의 클라이언트 매칭 로직을 서버 사이드 기준으로 재구성):
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
이 로직은 서버 사이드(레시피 목록/상세는 Server Component)에서 실행하며, 클라이언트는 결과만 받아 렌더링 (5장 참고).

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

## 5. 기능 단위 명세 (Server Component 조회 + Server Action 변경, 필요시 API Route)

> 표의 Method/Path는 "논리적으로 이런 요청"이라는 뜻이며, 실제 구현은 GET 성격(조회)은 Server Component에서 직접 Supabase 호출, 그 외(추가/수정/삭제)는 Server Action으로 구현하는 것을 기본으로 함(1장 참고). 클라이언트 쪽에서 재검증이 잦은 재료 검색만 API Route(`/api/ingredients/search`)로 남겨둠.

| Method | Path(논리적 표기) | 설명 | 인증 | 기본 구현 형태 |
|---|---|---|---|---|
| GET | /api/ingredients/search?q={query} | 부분 문자열 매칭으로 재료 검색 | 필요 | API Route (타이핑마다 재검증 필요) |
| GET | fridge 목록 조회 | 내 냉장고 목록 조회 (카테고리별) | 필요 | Server Component |
| POST | fridge 재료 추가 | 재료 추가 (마스터 재료 또는 커스텀 재료) | 필요 | Server Action |
| PATCH | fridge 항목 수정 | 보유 여부, 유통기한 수정 | 필요 | Server Action |
| DELETE | fridge 항목 삭제 | 재료 삭제 | 필요 | Server Action |
| GET | recipes 목록 조회 (filter={all\|full\|partial}) | 레시피 추천 목록 (매칭 결과 포함) | 필요 | Server Component |
| GET | recipes 상세 조회 | 레시피 상세 (매칭 결과 + 영양정보 포함) | 필요 | Server Component |
| POST | recipes 조회 기록 | 조회 기록 남기기 (upsert) | 필요 | Server Action |
| POST | recipes 즐겨찾기 추가 | 즐겨찾기 추가 | 필요 | Server Action |
| DELETE | recipes 즐겨찾기 해제 | 즐겨찾기 해제 | 필요 | Server Action |
| POST | recipes 완성 처리 | 완성 처리 (재료 차감 + 통계 기록) | 필요 | Server Action |
| GET | mypage 요약 조회 | 최근 조회/즐겨찾기/통계 요약 | 필요 | Server Component |

> 가정: 요청/응답 상세 스키마(필드명, 타입)는 이 표 수준까지만 정의하고, 실제 구현 단계에서 프론트와 함께 최종 확정하는 것으로 가정함. 별도 API_CONTRACT 문서는 이번 범위에서는 생략(엔드포인트 수가 적어 이 표로 충분하다고 판단). "기본 구현 형태" 열은 권장안이며, 팀 상황에 따라 전부 API Route로 통일해도 무방함.

---

## 6. 인증 및 보안

### 6.1 인증
- Supabase Auth (이메일 기반) 사용
- Server Component, Server Action, API Route 모두 동일하게 `@supabase/ssr`로 세션을 서버 사이드에서 검증
- 세션이 없으면 Server Action은 즉시 반환(권한 없음), API Route는 401 반환, Server Component는 로그인 페이지로 리다이렉트
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

### 6.5 타입 안전성 및 스키마 관리 (신규 보강)
- `supabase gen types typescript --project-id {id} > lib/database.types.ts` 명령으로 Supabase 스키마에서 TypeScript 타입을 직접 생성해 API Route와 프론트에서 공유. 테이블 필드를 손으로 다시 타이핑하지 않아 스키마 변경 시 컴파일 타임에 불일치를 바로 잡아낼 수 있음
- 테이블/RLS 정책 변경은 `supabase migration new {name}`으로 마이그레이션 파일을 만들어 버전 관리(Git)에 포함 — 콘솔에서 직접 스키마를 바꾸면 이력이 안 남아 팀 작업 시 꼬이기 쉬움

---

## 7. 배포/운영

- Vercel 배포 (Next.js 프로젝트와 함께)
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`(서버 전용, CSV 적재 스크립트용)
- CSV 적재 스크립트는 로컬 또는 별도 배치 환경에서 수동 실행 (Vercel 배포 파이프라인에는 포함하지 않음)

### 7.1 배포 전 체크리스트 (Backend-Guideline.md 검토 후 보강)
- [ ] 환경변수 Vercel에 등록 완료
- [ ] Supabase RLS 정책 전 테이블 적용 확인 (2.11 참고)
- [ ] Supabase CORS 정책 확인
- [ ] 이메일 인증 사용 여부 결정 및 설정
- [ ] API 키 등 민감 정보 코드에 하드코딩되어 있지 않은지 확인
- [ ] HTTPS 정상 적용 확인
- [ ] 레시피 CSV 적재 스크립트 1회 실행 및 결과 검증

---

## 8. 테스트 전략 (Backend-Guideline.md 검토 후 신규 추가)

### 8.1 단위 테스트
- 도구: **Vitest** 권장 (Next.js/Vite 생태계와 궁합이 좋고 설정이 가벼움; Jest도 대안 가능)
- 재료명 정규화 함수: "다진 마늘" → "다진마늘", "저염간장" → "간장"(동의어 통합) 등 케이스별 검증
- 레시피 매칭 함수: 보유 재료 조합에 따라 `full`/`partial` 상태와 부족 재료 목록이 정확히 나오는지 검증
- CSV 적재 예외 처리 함수(3.2 참고): 섹션 라벨 제거, 요리명 자기참조 제거, `MANUAL` 필드 말미 알파벳 제거가 실제 문제 사례(연두부 레시피의 "고명", "북엇국" 자기참조 등)에서 올바르게 동작하는지 회귀 테스트로 고정

### 8.2 통합 테스트
- 회원가입 → 재료 등록(검색/커스텀) → 레시피 추천 → 완성 처리 → 마이페이지 통계 반영까지 이어지는 흐름 전체 검증
- RLS 정책이 실제로 타 사용자 데이터 접근을 차단하는지 검증 (다른 계정으로 조회 시 빈 결과 확인)

### 8.3 E2E 테스트 (신규 보강)
- 도구: **Playwright** 권장 (모바일/데스크톱 뷰포트 전환, 웹 상단 네비게이션 ↔ 모바일 하단 탭 레이아웃 검증에 적합)
- 핵심 시나리오만 우선 커버: 회원가입 → 재료 검색·등록 → 레시피 완성 처리 → 마이페이지 통계 확인. 전체 화면을 다 커버하기보다 "핵심 플로우가 깨지지 않았는지" 확인하는 스모크 테스트로 시작해 점진적으로 확장

---

## 9. 범위 밖으로 확정된 항목 (참고용)

- **영수증 텍스트 인식(OCR)**: Naver Clova OCR 검토했으나, 비용 불확실성과 개발 복잡도 대비 MVP 핵심 가치 기여도가 낮다고 판단하여 P2로 유지, 별도 착수 시점 미정
- **의학적 식이 제한 기반 추천**: 서비스 범위에서 명시적으로 제외 (일반 목표 기반 필터만 지원)

---

## 10. 문서 통합 시 상충 사항 및 해결 방향

본 문서(현재 버전, 상단 헤더 참고)는 별도로 검토된 Backend-Guideline.md의 내용을 참고해 통합하고, 이후 실제 CSV 파일 검토 결과까지 반영한 결과입니다. 두 문서가 상충한 지점과 채택 근거는 다음과 같습니다.

| 항목 | 본 문서(BACKEND-INTEGRATED.md, 기준) | Backend-Guideline.md | 채택 및 근거 |
|---|---|---|---|
| 냉장고 데이터 저장 위치 | Supabase `user_fridge` 테이블 | 브라우저 localStorage | 본 문서 채택. localStorage는 기기 변경/브라우저 데이터 삭제 시 유실되고 기기 간 동기화 불가 |
| 레시피 데이터 로드 방식 | CSV를 서버에서 1회 적재해 `recipes` 테이블로 관리 | 클라이언트가 매 세션 CSV를 fetch해 런타임 파싱 | 본 문서 채택. 매번 파싱은 성능/일관성 면에서 불리하고, 여러 사용자가 같은 데이터를 참조하는 구조에 맞지 않음 |
| 재료 마스터 DB | Supabase `ingredients_master` 테이블 | 클라이언트 메모리 Map, DB 미구현 | 본 문서 채택. 서버에서 관리해야 검색/동의어 매칭을 여러 클라이언트가 일관되게 사용 가능 |
| 인증 실패 시 로컬 폴백 | 없음 (Supabase Auth 단일 경로) | 비밀번호를 base64로 localStorage에 저장하는 로컬 인증 폴백 | 채택하지 않음. 비밀번호를 클라이언트에 노출 가능한 형태로 저장하는 것은 보안 원칙에 위배됨 |
| Row-Level Security | 미기재 | 정책 예시 제공 | Backend-Guideline.md 내용 흡수 (2.11) |
| 사용자 환경설정 테이블 | 없음 | `user_preferences`(default_category, auto_add_basics) | 개념은 흡수하되 필드는 최근 논의(수량 관리 토글, 유통기한 알림 토글)에 맞게 재구성 |
| 재료명 정규화 파이프라인 | 개략적 서술 | 8단계 상세 파이프라인 | Backend-Guideline.md 내용 흡수 (3.1) |
| 보안/에러처리/테스트/배포 체크리스트 | 간략 | 상세 | Backend-Guideline.md 내용 흡수 (6.2~6.4, 7.1, 8장) |

> 이 섹션은 통합 과정의 의사결정 근거를 남기기 위한 것으로, 실제 구현 시 참고 문서(Backend-Guideline.md)를 다시 확인할 필요는 없습니다.
