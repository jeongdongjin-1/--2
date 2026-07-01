// ──────────────────────────────────────────────────────────────────────────
// 부동산 대출/정책 규칙 (1일 단위 갱신 대상)
//
// 아래 값은 2025.10.15 「주택시장 안정화 대책」(10.15 대책) 기준으로 채웠다.
// 출처: 국토교통부/금융위 보도자료, 은행권 안내.
//   - 규제지역: 서울 전역(25구) + 경기 12곳(과천·광명·성남 분당/수정/중원·
//     수원 영통/장안/팔달·안양 동안·용인 수지·의왕·하남) — 조정대상+투기과열
//   - 규제지역 LTV 40%, 비규제(수도권 그 외) 70%, 생애최초 우대 상한 80%
//   - DSR 한도 40%
//   - 스트레스 DSR 하한: 수도권·규제지역 주담대 3%p, 그 외 1.5%p
//   - 수도권 주담대 한도(주택가격 구간별): 15억↓ 6억 / 15~25억 4억 / 25억↑ 2억
//
// ⚠️ 기준 대출금리(baseLoanRate)는 시장금리라 은행별·시점별로 다르다(가정값).
//    규제는 수시로 바뀌므로 effectiveDate/note와 함께 갱신할 것.
// ──────────────────────────────────────────────────────────────────────────

export type LoanCapTier = {
  maxPriceWon: number // 이 주택가격 이하일 때
  capWon: number // 주담대 한도(원)
}

export type PolicyRule = {
  effectiveDate: string // 시행일 (YYYY-MM-DD)
  note: string
  sources: string[]

  dsrLimit: number // DSR 한도 (예: 0.40)

  // 스트레스 DSR 가산금리 (한도 산정 시 실제 금리에 더함)
  stressRateRegulated: number // 수도권·규제지역 주담대
  stressRateNonRegulated: number // 그 외

  baseLoanRate: number // 한도 역산용 기준 대출금리(연)
  maxTermYears: number // 만기(년), 원리금균등 가정

  ltv: {
    regulated: number // 규제지역 일반
    nonRegulated: number // 비규제(수도권 그 외) 일반
    firstTime: number // 생애최초 우대 상한
  }

  // 수도권 주담대 절대 한도 — 주택가격 구간별(작은 구간부터 정렬)
  loanCapTiers: LoanCapTier[]

  // 규제지역 시군구 코드(LAWD 5자리)
  regulatedCodes: string[]
}

// 서울 25개 구 전체
const SEOUL_ALL = [
  '11110', '11140', '11170', '11200', '11215', '11230', '11260', '11290',
  '11305', '11320', '11350', '11380', '11410', '11440', '11470', '11500',
  '11530', '11545', '11560', '11590', '11620', '11650', '11680', '11710', '11740',
]
// 경기 12곳 (10.15 대책 규제지역)
const GYEONGGI_REG = [
  '41290', // 과천
  '41210', // 광명
  '41135', '41131', '41133', // 성남 분당/수정/중원
  '41117', '41111', '41115', // 수원 영통/장안/팔달
  '41173', // 안양 동안
  '41465', // 용인 수지
  '41430', // 의왕
  '41450', // 하남
]

export const CURRENT_POLICY: PolicyRule = {
  effectiveDate: '2025-10-16',
  note: '2025.10.15 주택시장 안정화 대책 기준. 기준 대출금리는 가정값(은행별 상이).',
  sources: [
    '국토교통부/금융위 10.15 주택시장 안정화 대책',
    'https://www.molit.go.kr/policy/stable/sta_b_03.jsp',
  ],
  dsrLimit: 0.4,
  stressRateRegulated: 0.03,
  stressRateNonRegulated: 0.015,
  baseLoanRate: 0.043,
  maxTermYears: 30,
  ltv: {
    regulated: 0.4,
    nonRegulated: 0.7,
    firstTime: 0.8,
  },
  loanCapTiers: [
    { maxPriceWon: 1_500_000_000, capWon: 600_000_000 }, // 15억 이하 → 6억
    { maxPriceWon: 2_500_000_000, capWon: 400_000_000 }, // 15~25억 → 4억
    { maxPriceWon: Infinity, capWon: 200_000_000 }, // 25억 초과 → 2억
  ],
  regulatedCodes: [...SEOUL_ALL, ...GYEONGGI_REG],
}

export const POLICY_HISTORY: PolicyRule[] = [CURRENT_POLICY]
