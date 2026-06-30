// ──────────────────────────────────────────────────────────────────────────
// 부동산 대출/정책 규칙 (1일 단위 갱신 대상)
//
// 이 파일의 수치는 "정책"이므로 자주 바뀐다. 계산 로직(lib/affordability.ts)은
// 건드리지 말고 여기 값만 갱신하면 한도 계산 결과가 바뀐다.
//
// ⚠️ 아래 값은 일반적인 골격을 채운 "샘플 기본값"이다. 실제 시행 중인 규제·금리는
//    금융위원회/국토부/은행 고시를 확인해 effectiveDate와 함께 갱신할 것.
// ──────────────────────────────────────────────────────────────────────────

export type PolicyRule = {
  effectiveDate: string // 이 규칙이 적용되는 시행일 (YYYY-MM-DD)
  note: string

  // DSR (총부채원리금상환비율) 한도
  dsrLimit: number // 예: 0.40 = 연소득의 40%까지 원리금 허용

  // 스트레스 DSR: 한도 산정 시 실제 금리에 더해 적용하는 가산 금리
  stressRate: number // 예: 0.015 = 1.5%p

  // 대출 산정에 쓰는 기준 대출금리(연) — 한도 역산용
  baseLoanRate: number // 예: 0.043 = 4.3%

  // 만기(년) — 원리금 균등 가정
  maxTermYears: number // 예: 30

  // LTV (담보인정비율) 구간
  ltv: {
    regulated: number // 규제지역(투기과열/조정) 일반
    nonRegulated: number // 비규제지역 일반
    firstTime: number // 생애최초 우대 (지역 무관 상한)
  }

  // 수도권/규제지역 주택담보대출 절대 한도(원). null이면 미적용.
  // (예: 2025.6.27 대책 — 수도권·규제지역 주담대 최대 6억)
  loanHardCapWon: number | null

  // 규제지역(LAWD_CD 5자리) 목록. 여기 포함되면 regulated LTV 적용.
  regulatedCodes: string[]
}

// 현재 적용 규칙 (가장 최신 1건). 히스토리는 POLICY_HISTORY로 관리.
export const CURRENT_POLICY: PolicyRule = {
  effectiveDate: '2026-06-01',
  note: '샘플 기본값 — 실제 고시 확인 후 갱신 필요. 수도권 주담대 6억 한도 가정.',
  dsrLimit: 0.4,
  stressRate: 0.015,
  baseLoanRate: 0.043,
  maxTermYears: 30,
  ltv: {
    regulated: 0.5,
    nonRegulated: 0.7,
    firstTime: 0.8,
  },
  loanHardCapWon: 600_000_000,
  // 서울 강남3구 + 용산 등 대표 규제지역 가정 (샘플)
  regulatedCodes: ['11650', '11680', '11710', '11170'],
}

export const POLICY_HISTORY: PolicyRule[] = [CURRENT_POLICY]
