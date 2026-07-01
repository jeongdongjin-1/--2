// ──────────────────────────────────────────────────────────────────────────
// 신혼부부 · 다자녀 · 신생아 가구 주택 혜택 데이터 (참고용 · 갱신 대상)
//
// 주택도시기금(HUG)·정부 지원 대출/청약 특별공급의 골격. 수치는 2024~2025 공고 기준의
// 대략값이며, 소득요건/한도/금리는 자주 바뀌므로 effectiveNote와 함께 갱신할 것.
// 실제 신청 가능 여부·금리는 기금e든든(nhuf.molit.go.kr) / 청약홈에서 확인.
// ──────────────────────────────────────────────────────────────────────────

export type Household = 'newlywed' | 'multichild' | 'newborn'

export type LoanProduct = {
  id: string
  name: string
  category: '구입자금' | '전세자금'
  households: Household[] // 어떤 가구 유형에 해당하는지
  incomeLimit: string // 부부합산 연소득 요건(표시용)
  incomeLimitWon: number // 소득 요건 숫자값(자격 판정용)
  assetLimit?: string // 순자산 요건
  targetPrice: string // 대상 주택/보증금 한도
  targetPriceWon: number // 대상 주택가격(또는 보증금) 상한 숫자값
  loanLimit: string // 대출 한도
  loanLimitWon: number // 대출 한도 숫자값(전략 계산용)
  rate: string // 금리(연)
  highlights: string[]
  basis: string // 근거(상품/제도명)
}

// 정부 지원 대출 상품
export const LOAN_PRODUCTS: LoanProduct[] = [
  {
    id: 'newborn-purchase',
    name: '신생아 특례 디딤돌 (구입)',
    category: '구입자금',
    households: ['newborn'],
    incomeLimit: '부부합산 1.3억 이하 (완화 시 2억까지 추진)',
    incomeLimitWon: 130_000_000,
    assetLimit: '순자산 4.69억 이하',
    targetPrice: '주택가격 9억 이하 · 전용 85㎡ 이하',
    targetPriceWon: 900_000_000,
    loanLimit: '최대 5억',
    loanLimitWon: 500_000_000,
    rate: '연 1.6 ~ 3.3% (소득·만기별 차등)',
    highlights: [
      '대출 신청일 기준 2년 내 출산(임신 포함) 무주택 가구',
      '추가 출산 시 1명당 0.2%p 추가 금리 인하 + 특례기간 연장',
      '가장 금리가 낮은 대표 상품',
    ],
    basis: '주택도시기금 · 신생아 특례 구입자금대출',
  },
  {
    id: 'newlywed-purchase',
    name: '신혼부부 디딤돌 (구입)',
    category: '구입자금',
    households: ['newlywed'],
    incomeLimit: '부부합산 8.5천만 이하',
    incomeLimitWon: 85_000_000,
    assetLimit: '순자산 4.69억 이하',
    targetPrice: '주택가격 6억 이하 · 전용 85㎡ 이하',
    targetPriceWon: 600_000_000,
    loanLimit: '최대 4억',
    loanLimitWon: 400_000_000,
    rate: '연 2.45 ~ 3.55% (우대금리 적용 가능)',
    highlights: [
      '혼인 7년 이내 또는 3개월 내 결혼예정',
      '무주택 세대주, 생애최초·다자녀 우대금리 중복 가능',
    ],
    basis: '주택도시기금 · 내집마련 디딤돌대출(신혼 우대)',
  },
  {
    id: 'multichild-purchase',
    name: '다자녀 디딤돌 우대 (구입)',
    category: '구입자금',
    households: ['multichild'],
    incomeLimit: '부부합산 7천만 이하 (다자녀 우대 시 상향)',
    incomeLimitWon: 70_000_000,
    targetPrice: '주택가격 6억 이하',
    targetPriceWon: 600_000_000,
    loanLimit: '자녀 수에 따라 최대 4억',
    loanLimitWon: 400_000_000,
    rate: '기본금리 - 자녀수 우대 (2자녀 0.5%p · 3자녀 이상 0.7%p)',
    highlights: [
      '미성년 자녀 수에 따라 금리 우대폭·한도 확대',
      '청약 다자녀 특별공급과 병행 가능',
    ],
    basis: '주택도시기금 · 디딤돌대출 다자녀 우대',
  },
  {
    id: 'newborn-jeonse',
    name: '신생아 특례 버팀목 (전세)',
    category: '전세자금',
    households: ['newborn'],
    incomeLimit: '부부합산 1.3억 이하',
    incomeLimitWon: 130_000_000,
    targetPrice: '보증금 수도권 5억 이하 (지방 4억)',
    targetPriceWon: 500_000_000,
    loanLimit: '최대 3억',
    loanLimitWon: 300_000_000,
    rate: '연 1.1 ~ 3.0%',
    highlights: ['2년 내 출산 가구', '전세도 초저금리 특례 적용'],
    basis: '주택도시기금 · 신생아 특례 전세자금대출',
  },
  {
    id: 'newlywed-jeonse',
    name: '신혼부부 버팀목 (전세)',
    category: '전세자금',
    households: ['newlywed'],
    incomeLimit: '부부합산 7.5천만 이하',
    incomeLimitWon: 75_000_000,
    targetPrice: '보증금 수도권 4억 이하 (지방 3억)',
    targetPriceWon: 400_000_000,
    loanLimit: '수도권 최대 3억',
    loanLimitWon: 300_000_000,
    rate: '연 1.5 ~ 2.7%',
    highlights: ['혼인 7년 이내', '저리 전세 + 청약통장 유지 권장'],
    basis: '주택도시기금 · 신혼부부 전용 전세자금대출',
  },
]

// 가구 유형별 요약 (탭 헤더 카드용)
export type HouseholdInfo = {
  key: Household
  emoji: string
  title: string
  summary: string
  benefits: string[]
  basis: string[]
}

export const HOUSEHOLD_INFO: HouseholdInfo[] = [
  {
    key: 'newlywed',
    emoji: '💍',
    title: '신혼부부',
    summary: '혼인 7년 이내(또는 결혼예정). 저리 대출 + 청약 특별공급 + 세제 혜택을 묶어서 활용.',
    benefits: [
      '디딤돌·버팀목 우대금리로 구입/전세 저리 대출',
      '청약 신혼부부 특별공급 (민영·국민 모두 별도 물량)',
      '취득세 감면(생애최초 최대 200만원) 등 세제 지원',
      '신혼희망타운·공공분양(뉴홈) 신혼 유형 지원 자격',
    ],
    basis: ['주택공급규칙 특별공급', '주택도시기금 신혼 우대', '지방세특례제한법 취득세 감면'],
  },
  {
    key: 'newborn',
    emoji: '👶',
    title: '신생아 가구',
    summary: '2년 내 출산(임신 포함) 가구. 현재 가장 금리가 낮은 신생아 특례가 핵심.',
    benefits: [
      '신생아 특례 구입(최대 5억)·전세(최대 3억) 초저금리',
      '추가 출산 시 금리 추가 인하 + 특례기간 연장',
      '청약 신생아 특별공급/우선공급 신설 물량',
    ],
    basis: ['신생아 특례 대출(주택도시기금)', '뉴홈 신생아 특별공급'],
  },
  {
    key: 'multichild',
    emoji: '👨‍👩‍👧‍👦',
    title: '다자녀 가구',
    summary: '미성년 2자녀 이상(일부 제도는 2자녀부터). 자녀 수에 비례해 한도·금리·청약 가점 확대.',
    benefits: [
      '디딤돌 다자녀 우대금리(2자녀 0.5%p·3자녀 0.7%p)',
      '청약 다자녀 특별공급(배점제: 자녀수·무주택기간 등)',
      '취득세·재산세 감면, 다자녀 우선 공급',
    ],
    basis: ['주택공급규칙 다자녀 특별공급', '디딤돌 다자녀 우대'],
  },
]
