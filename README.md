# 🏠 집찾기 — 수도권 아파트 실거래가 + 내가 살 수 있는 집 매칭

네이버 부동산처럼 수도권(서울·경기·인천) 아파트를 보되, **최신 정책·대출 한도(DSR/LTV)를 반영해
"내가 실제로 입주 가능한 매물"을 골라주는** 웹/PC 앱.

## 핵심 기능 (탭 구성)
- **🏠 내가 살 수 있는 집** — 연소득·자산·부채·가구정보로 DSR/LTV/정책 한도 + **취득세·중개보수 등
  부대비용까지 반영**한 최대 구매가 산출. **아파트/오피스텔/빌라 선택**, 데이터 있는 최신 달 자동 조회,
  받을 수 있는 대출·혜택 자동 표시, 매물별 **네이버 부동산·카카오맵 바로가기**.
- **🗺️ 지도** — 시군구 요약 마커 → **클릭하면 개별 단지 마커로 드릴다운**(클러스터링). 단지별로 중위 실거래가·
  전용면적·입주 가능 여부(초록/빨강). 위치는 **카카오 지오코딩**(키 없으면 근사). (Leaflet + OpenStreetMap)
- **⚖️ 청약·매매 전략** — 개인 자금으로 **청약 루트(특별공급 정책대출→감당 분양가)** vs **매매 루트(최대 구매가)**를
  비교. 시간 여유형/자금 여유형 성향별 추천 + 신혼·다자녀·신생아 맞춤 전략.
- **📰 정책 브리핑** — 규제·대출·청약 변화를 타임라인으로, 각 변화가 내 전략에 미치는 영향까지.
  **최신 소식 자동 업데이트**: 국토부·금융위·정책브리핑 보도자료 RSS를 서버가 수집(6시간 캐시)해
  부동산 관련 소식만 골라 상단에 표시(원문 링크 연결).
- **💍 신혼·다자녀 혜택** — 신혼부부/신생아/다자녀 가구별 핵심 혜택 + 근거 정책 + 해당 정부 지원
  대출 상품(신생아 특례·디딤돌·버팀목 등)을 카드로 정리.
- **📅 청약 캘린더** — 월 단위 달력에 청약 일정 표시 + 특별공급 유형 안내.
  **한국부동산원 청약홈 공공 API 연동**(키 미설정 시 샘플 일정 폴백). 일정 클릭 시
  **평형별 분양가**(주택형·전용면적·세대수·분양가)와 **실제 특별공급 유형**을 표로 표시.
- **🎖️ 군인공제 비교** — 군인공제회 혜택 vs 정부 기금·민간 비교표 + **기관추천(군 등) 물량 있는
  청약 일정 자동 표시**(접수일·세대수·공고 링크).
- **정책 1일 단위 반영** — 대출/혜택/일정 데이터를 `src/data/*`에서 분리 관리. 수치만 갱신하면 즉시 반영.
- **공공 실거래가/청약 API** — 공공데이터포털 합법 API. 키 미설정 시 목업/샘플로 동작.
- **개인정보 보호** — 입력값은 브라우저(localStorage)에만 저장, 서버 전송 없음.
- **PC 설치 앱** — Electron portable .exe로 패키징(설치 불필요, 무관리자 권한).

## 실행
```bash
npm install
npm run dev      # 웹(5173) + API 프록시(4000) 동시 실행
# 웹만:  npm run dev:web
# API만: npm run dev:api
```
빌드 + 프로덕션 서빙:
```bash
npm run build && npm run preview   # http://localhost:4000
```

## 온라인 배포 (공개 URL 만들기)
이 앱은 **Node 서버 1개**가 API + 화면을 모두 서빙하므로, Node 호스트에 올리면 공개 URL이 생깁니다.
(GitHub Pages 같은 정적 호스팅은 백엔드 API가 없어 부적합)

**Render.com 무료 배포 (`render.yaml` 포함):**
1. [render.com](https://render.com) 가입 → **New + → Blueprint** → 이 깃허브 저장소 선택
2. 환경변수 입력(대시보드): `APPLYHOME_SERVICE_KEY`, `MOLIT_SERVICE_KEY`, `KAKAO_REST_KEY`
3. 배포되면 `https://zipchatgi.onrender.com` 형태의 공개 주소가 발급됩니다.

> 빌드: `npm install && npm run build` · 실행: `node server/index.mjs` (PORT는 호스트가 주입)
> Railway/Fly.io 등 다른 Node 호스트도 동일 명령으로 가능.

## PC 설치 앱 (Electron)
개발 중 데스크톱 앱으로 실행:
```bash
npm run build && npm run electron
```
배포용 portable .exe 빌드(설치 불필요):
```bash
npm run dist          # → release/집찾기-<버전>-portable.exe
```
> 이 PC에서는 NSIS 설치본이 winCodeSign 심볼릭 링크 권한 오류를 일으키므로 **portable 타겟**을 사용합니다.

## API 키 설정
`.env.example`을 `.env`로 복사 후 채우고 서버 재시작. 키가 없으면 목업/근사로 동작합니다.

| 키 | 용도 | 발급처 | 없을 때 |
|---|---|---|---|
| `MOLIT_SERVICE_KEY` | 아파트 실거래가 | [data.go.kr](https://www.data.go.kr) "국토교통부_아파트 매매 실거래가 자료" 활용신청 | 목업 거래 데이터 |
| `APPLYHOME_SERVICE_KEY` | 청약 캘린더 일정 | data.go.kr "한국부동산원_청약홈 분양정보 조회 서비스" 활용신청 | 샘플 일정 |
| `KAKAO_REST_KEY` | 지도 단지 위치(지오코딩) | [developers.kakao.com](https://developers.kakao.com) 앱 → REST API 키 | 구 중심 주변 근사 배치 |

> data.go.kr 인증키는 **계정당 1개**로, 활용신청(승인)한 API 모두에 동일 키가 적용됩니다.
> 키 입력 시 **일반 인증키(Decoding)** 를 사용하세요.
> **지도에 실제 단지명·정확 위치**를 보려면 `MOLIT_SERVICE_KEY`(실제 거래) + `KAKAO_REST_KEY`(정확 좌표) 둘 다 필요합니다.

## 구조
```
electron/
  main.cjs     Electron 메인(내장 서버 기동 + 창 로드)
server/        API 프록시(키 은닉) + 프로덕션 정적 서빙
  molit.mjs    실거래가 호출 + XML 파싱 + 목업 폴백
  applyhome.mjs 청약홈 분양정보 호출 + 샘플 폴백
  geocode.mjs  카카오 지오코딩(단지명→좌표) + 캐시
src/
  data/         ★ 모두 1일 단위 갱신 대상 (수치는 참고용 샘플)
    regions.ts      서울 25구 + 경기·인천 LAWD 코드 + 좌표
    policy.ts       대출/정책 규칙 (DSR·LTV·규제지역·한도)
    benefits.ts     신혼·다자녀·신생아 혜택 + 정부 지원 대출 상품
    subscription.ts 청약 특별공급 유형 + 캘린더 일정(폴백)
    military.ts     군인공제 vs 정부기금 vs 민간 비교
  lib/
    affordability.ts  ★ DSR/LTV → 최대 구매가 계산 엔진
    eligibility.ts    ★ 프로필 → 받을 수 있는 대출/혜택 판정
    profileStore.ts   개인정보 로컬 저장 + 동의 관리
  tabs/
    MatchTab / MapTab / BenefitsTab / CalendarTab / MilitaryTab
  App.tsx      탭 셸 + 개인정보 동의 게이트
```

## 로드맵
- [x] 지도 뷰(서울·수도권 마커, 입주가능 색상)
- [x] 청약홈 공공 API 연동(샘플 → 실데이터)
- [x] 혜택 ↔ 매칭 연결(프로필 기반 자격 자동 표시)
- [x] Electron 패키징(portable .exe)
- [x] 지도 개별 단지 마커 + 지오코딩(카카오, 미설정 시 근사)
- [x] 청약 평형별 분양가 + 실제 특별공급 유형 연동(getAPTLttotPblancMdl)
- [x] 온라인 배포(공개 URL) — Render (https://zipchatgi.onrender.com)
- [x] 정책 실제화(2025.10.15 대책: 규제지역/LTV/스트레스DSR/가격구간 한도)
- [x] 핵심 계산 단위 테스트(vitest 16개) — `npm test`
- [x] 실거래가 페이지네이션(여러 페이지 합산), 평형·연식 필터, 청약 지역·유형 필터
- [x] 지오코딩 파일 캐시 + 지도 동시성 제한, 접근성(ARIA)·개인정보 초기화
- [x] 청약·매매 전략 비교 탭(시간/자금 여유형, 가구 맞춤 전략)
- [x] 정책 브리핑 탭(규제·대출·청약 변화 타임라인 + 전략 영향)
- [x] 지도 마커 클러스터링(react-leaflet-cluster)
- [x] 정책 브리핑 최신 소식 자동 수집(국토부·금융위·korea.kr RSS, 6시간 캐시)
- [ ] 오피스텔·빌라 실거래가 활용신청(코드는 연결됨)

## ⚠️ 주의
- `src/data/policy.ts`의 수치는 **샘플 기본값**입니다. 실제 시행 중인 규제·금리·규제지역은
  금융위/국토부 고시를 확인해 갱신하세요. 계산 결과는 참고용이며 실제 대출 가능 여부는
  금융기관 심사에 따릅니다.
- 네이버 등 민간 사이트 무단 크롤링은 약관 위반이라 사용하지 않습니다. 데이터는 공공 API만 사용.
