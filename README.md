# 🏠 집찾기 — 수도권 아파트 실거래가 + 내가 살 수 있는 집 매칭

네이버 부동산처럼 수도권(서울·경기·인천) 아파트를 보되, **최신 정책·대출 한도(DSR/LTV)를 반영해
"내가 실제로 입주 가능한 매물"을 골라주는** 웹/PC 앱.

## 핵심 기능 (탭 구성)
- **🏠 내가 살 수 있는 집** — 연소득·자산·부채·가구정보를 입력하면 DSR/LTV/정책 한도를 계산해
  최대 구매가를 산출하고, 그 이하 실거래 매물만 강조. **내 프로필 기준으로 받을 수 있는 대출·혜택 자동 표시.**
- **🗺️ 지도** — 시군구 요약 마커 → **클릭하면 개별 단지 마커로 드릴다운**. 단지별로 중위 실거래가·전용면적·
  입주 가능 여부를 점으로 표시(초록=입주 가능, 빨강=예산 초과). 단지 위치는 **카카오 지오코딩**으로 정확 배치,
  키가 없으면 구 중심 주변 근사 배치. (Leaflet + OpenStreetMap, 지도 타일은 키 불필요)
- **💍 신혼·다자녀 혜택** — 신혼부부/신생아/다자녀 가구별 핵심 혜택 + 근거 정책 + 해당 정부 지원
  대출 상품(신생아 특례·디딤돌·버팀목 등)을 카드로 정리.
- **📅 청약 캘린더** — 월 단위 달력에 청약 일정 표시 + 특별공급 유형 안내.
  **한국부동산원 청약홈 공공 API 연동**(키 미설정 시 샘플 일정 폴백). 일정 클릭 시
  **평형별 분양가**(주택형·전용면적·세대수·분양가)와 **실제 특별공급 유형**을 표로 표시.
- **🎖️ 군인공제 비교** — 군인공제회 혜택을 정부 기금 대출·민간 시중은행과 항목별 비교표로 제시 + 추천 조합.
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
- [ ] 온라인 배포(공개 URL) — Render/Railway 등 Node 호스트
- [ ] 정책 일일 브리핑(금융위·HUG 공지 요약) + 변화 알림
- [ ] 실거래가 캐시/여러 달 합산, 평형·연식 필터

## ⚠️ 주의
- `src/data/policy.ts`의 수치는 **샘플 기본값**입니다. 실제 시행 중인 규제·금리·규제지역은
  금융위/국토부 고시를 확인해 갱신하세요. 계산 결과는 참고용이며 실제 대출 가능 여부는
  금융기관 심사에 따릅니다.
- 네이버 등 민간 사이트 무단 크롤링은 약관 위반이라 사용하지 않습니다. 데이터는 공공 API만 사용.
