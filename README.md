# teamap · 중국 차 지도 (中國茶地圖)

중국의 성(省) → 시(市) → 현·구(县/区) 단위 산지별로 6대 다류의 명차를 찾아보고 등록하는 지도.

- **스택**: Next.js 16 (App Router) · Tailwind CSS 4 · shadcn/ui · Framer Motion · d3-geo · Supabase · Vercel
- **지도**: 阿里云 DataV 행정구역 경계 (전국 3,237개 구역) → TopoJSON 으로 압축해 `public/geo/` 에 포함
- **한자↔한글**: Unicode Unihan 한국 독음 + 차·지명 단어 사전, 두음법칙 적용, 간체↔번체 변환

## 로컬에서 실행

```bash
npm install
npm run dev          # http://localhost:3000
```

Supabase 설정이 없으면 자동으로 **로컬 파일 저장소**(`.data/teas.json`, `.data/uploads/`)를 씁니다.
처음 실행할 때 대표 명차 31종이 채워지고, `ADMIN_PASSWORD` 를 비워두면 로그인 없이 편집할 수 있습니다.
처음 상태로 되돌리려면 `.data/` 폴더를 지우면 됩니다.

## 기능

| 기능 | 설명 |
| --- | --- |
| 지도 탐색 | 성을 누르면 시 단위, 시를 누르면 현·구 단위 지도로 들어갑니다. 휠/핀치로 확대, 상단 경로로 이동 |
| 산지 표시 | 차가 있는 구역은 대표 다류 색으로 칠하고 개수를 표시. 목록에서 차에 마우스를 올리면 산지가 강조됩니다 |
| 차 등록 | 사진(여러 장, 끌어서 순서 변경), 설명, 6대 다류, 산지(여러 곳, 현·구 단위까지) |
| 한자 → 한글 | 간체를 입력하면 번체와 한글 독음이 자동으로 채워짐 (`西湖龙井` → `西湖龍井` / `서호용정`) |
| 한글 → 한자 | 한글로 쓰고 「한글 → 한자」를 누르면 사전 단어·지명을 찾아 바꾸고, 음절마다 다른 한자 후보를 고를 수 있음 |
| 지역 검색 | `항주`, `杭州`, `杭州市`, `무이산` 처럼 한글·간체·번체 아무거나로 검색 |
| 설명 독음 달기 | 설명 속 한자를 `암운(岩韻)` 형식으로 바꿔 줌 |
| 지도에서 바로 등록 | (관리자) 현·구 지도에서 원하는 위치를 길게 누르면 그 현과 위치(핀)가 지정된 채 새 차 등록 창이 열리고, 세부 산지 이름만 입력 |
| 세부 산지 | 현·구 산지 아래에 향·진(乡镇, 공식 목록 41,352곳)을 고르거나 차산·마을 이름을 직접 입력하고, 그 현 지도에서 눌러 위치를 찍으면 지도에 핀으로 표시 |
| 제품 | 대표 차 아래에 차창·브랜드별 제품 등록 (예: 普洱茶 → 勐海茶厂 7542, 7572). 제품마다 이름·제조사·산지·사진·설명·마신 기록 |
| 마신 기록 | 차 상세의 「마신 기록」 탭에서 날짜·별점(0.5 단위)·사진·가격/양·구매처·생산 연도·우림 정보·향·맛·메모를 남김. 상단 「마신 기록」에서 전체 기록을 월별로, 목록에서 「마신 차」만 걸러 보기 |

## 환경 변수 (`.env.local`)

`.env.example` 을 복사해 사용하세요.

| 변수 | 설명 |
| --- | --- |
| `ADMIN_PASSWORD` | 관리자 비밀번호. **배포 환경에서는 필수** (없으면 편집 불가) |
| `ADMIN_SECRET` | (선택) 로그인 쿠키 서명 키 |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role 키 (서버에서만 사용, 브라우저로 노출되지 않음) |

## Supabase + Vercel 배포

1. **Supabase 프로젝트 생성** 후 SQL Editor 에서 `supabase/migrations/` 의 SQL 을 순서대로 실행
   - `20261028000000_init.sql` — 테이블 `teas`, 공개 읽기 RLS, 이미지 버킷 `tea-images`
   - `20261028010000_tastings.sql` — 마신 기록 테이블 `tastings`
   - `20261028020000_tea_products.sql` — 제품(하위 차)용 컬럼 `parent_id`, `maker`
2. `.env.local` 에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 입력
3. 데이터 넣기 — 둘 중 하나
   - 로컬에서 입력한 데이터를 그대로 옮기기: `npm run migrate:supabase` (사진도 Storage 로 업로드)
   - 대표 명차만 넣기: `npm run seed:supabase`
4. GitHub 에 push → Vercel 에서 저장소 Import → 환경 변수 3개(`ADMIN_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) 설정 → Deploy

> Vercel 은 파일 시스템에 쓸 수 없으므로 배포 환경에서는 반드시 Supabase 를 설정해야 합니다.

## 데이터 다시 만들기

```bash
npm run geo:fetch     # DataV 경계 데이터 → public/geo/*.json, src/data/regions.json
npm run hanja:build   # .cache/unihan 의 Unihan DB → src/data/hanja.json
npm run towns:build   # 향·진 이름 목록 → public/towns/{현 adcode}.json
```

`hanja:build` 전에 [Unihan.zip](https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip) 을 `.cache/unihan/` 에 풀어 두세요.
독음이 틀린 글자는 `scripts/build-hanja.mjs` 의 `OVERRIDES`, 단어 단위 예외(관용 독음, 단어 중간 두음법칙)는 `src/data/dictionary.ts` 에 추가합니다.

## 구조

```
src/
  app/api/           teas(CRUD) · upload · uploads(로컬 이미지) · auth
  components/map/    china-map.tsx — d3-geo SVG 지도, 확대/드릴다운
  components/tea/    등록 폼, 이름(한자↔한글) 입력, 산지 선택, 사진, 상세
  lib/hanja.ts       한자↔한글 변환기
  lib/store/         local(JSON 파일) / supabase 저장소
  data/              hanja.json · regions.json · dictionary.ts · seed-teas.ts
public/geo/          행정구역 경계 TopoJSON (adcode 별)
public/towns/        현별 향·진 이름 목록 (경계 없음, 출처: modood/Administrative-divisions-of-China)
supabase/migrations/ DB 스키마
```
