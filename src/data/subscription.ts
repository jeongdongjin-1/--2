// ──────────────────────────────────────────────────────────────────────────
// 청약 데이터 — 특별공급 유형 + 캘린더 일정
//
// ⚠️ 아래 일정(EVENTS)은 캘린더 UI 동작 확인용 "샘플"이다. 실제 분양/청약 일정은
//    청약홈(applyhome.co.kr) 또는 한국부동산원 청약홈 공공 API(data.go.kr,
//    "한국부동산원_청약홈 분양정보/일정 조회 서비스")로 받아 갱신할 것.
// ──────────────────────────────────────────────────────────────────────────

// 청약 특별공급 유형 (가구 유형별 자격 안내)
export type SpecialSupply = {
  key: string
  name: string
  forHouseholds: string[] // 표시용 라벨
  ratio: string // 대략 공급 비율
  note: string
}

export const SPECIAL_SUPPLY: SpecialSupply[] = [
  {
    key: 'newlywed',
    name: '신혼부부 특별공급',
    forHouseholds: ['신혼부부', '예비신혼', '한부모'],
    ratio: '민영 18% · 국민 30% 내외',
    note: '혼인 7년 이내. 소득·자산 요건 충족 시 우선/일반공급. 자녀수·청약통장 가입기간 등 배점.',
  },
  {
    key: 'newborn',
    name: '신생아 특별/우선공급',
    forHouseholds: ['2년 내 출산'],
    ratio: '공공분양(뉴홈) 신설 물량',
    note: '입주자모집공고일 기준 2년 내 임신·출산 증빙. 가장 최신 신설 유형으로 경쟁 상대적으로 적음.',
  },
  {
    key: 'multichild',
    name: '다자녀 특별공급',
    forHouseholds: ['미성년 2자녀 이상'],
    ratio: '민영·국민 10% 내외',
    note: '배점제(미성년 자녀수·무주택기간·청약통장 등 합산 점수 순). 2자녀부터 신청 가능으로 확대.',
  },
  {
    key: 'firsttime',
    name: '생애최초 특별공급',
    forHouseholds: ['생애 첫 주택'],
    ratio: '민영 7% · 국민 25% 내외',
    note: '세대원 전원 무주택 + 과거 주택 소유 이력 없음. 추첨 비중 높아 신혼과 병행 전략 가능.',
  },
  {
    key: 'oldparent',
    name: '노부모 부양 특별공급',
    forHouseholds: ['65세 이상 직계존속 3년 이상 부양'],
    ratio: '민영·국민 일부',
    note: '무주택 세대주, 부양 가족 모두 무주택. 가점제 적용.',
  },
]

// 청약 일정 이벤트
export type SubscriptionEvent = {
  date: string // YYYY-MM-DD (해당 접수일)
  title: string // 단지명
  region: string // 지역(공급지역명)
  type: 'special' | 'first' | 'second' // 특별공급/1순위/2순위
  households: string[] // 해당 특별공급(라벨)
  priceNote?: string
  address?: string // 공급위치
  url?: string // 모집공고 URL(청약홈)
  winnerDate?: string // 당첨자 발표일 YYYY-MM-DD
  hmNo?: string // 주택관리번호(평형별 분양가 조회용)
  pbNo?: string // 공고번호
}

// 샘플 일정 (실데이터는 청약홈 API로 대체)
export const SUBSCRIPTION_EVENTS: SubscriptionEvent[] = [
  { date: '2026-07-06', title: '래미안 ○○ (샘플)', region: '서울 강동구', type: 'special', households: ['신혼부부', '생애최초', '다자녀'], priceNote: '전용 84㎡ 추정 13억대' },
  { date: '2026-07-07', title: '래미안 ○○ (샘플)', region: '서울 강동구', type: 'first', households: [] },
  { date: '2026-07-13', title: '힐스테이트 △△ (샘플)', region: '경기 하남시', type: 'special', households: ['신혼부부', '신생아', '노부모부양'], priceNote: '전용 74㎡ 추정 8억대' },
  { date: '2026-07-14', title: '힐스테이트 △△ (샘플)', region: '경기 하남시', type: 'first', households: [] },
  { date: '2026-07-20', title: '뉴홈 공공분양 □□ (샘플)', region: '인천 연수구', type: 'special', households: ['신생아', '신혼부부', '다자녀', '생애최초'], priceNote: '나눔형 6억대' },
  { date: '2026-07-21', title: '뉴홈 공공분양 □□ (샘플)', region: '인천 연수구', type: 'first', households: [] },
  { date: '2026-07-27', title: '자이 ◇◇ (샘플)', region: '경기 광명시', type: 'special', households: ['신혼부부', '다자녀'], priceNote: '전용 84㎡ 추정 10억대' },
]
