// ──────────────────────────────────────────────────────────────────────────
// "내가 살 수 있는 집" 핵심 계산 엔진
//
// 입력: 사용자 재무 프로필 + 정책 규칙(policy.ts)
// 출력: 최대 대출가능액, 최대 구매가능가, 한도를 결정한 제약(binding constraint)
// ──────────────────────────────────────────────────────────────────────────
import type { PolicyRule } from '../data/policy'

export type UserProfile = {
  annualIncomeWon: number // 연소득(부부합산이면 합산액)
  cashAssetsWon: number // 가용 현금/자산(자기자본)
  existingAnnualDebtPaymentWon: number // 기존 대출 연 원리금 상환액
  isFirstTime: boolean // 생애최초 주택구입 여부
  ownedHouses: number // 현재 보유 주택 수 (0 = 무주택)
  // 가구 정보 (혜택 매칭용)
  marriedWithin7yr: boolean // 혼인 7년 이내(또는 결혼예정) = 신혼부부
  newbornWithin2yr: boolean // 2년 내 출산(임신 포함) = 신생아 가구
  childrenCount: number // 미성년 자녀 수 (2 이상 = 다자녀)
}

export type AffordabilityResult = {
  maxLoanWon: number // 최대 대출 가능액
  maxPriceWon: number // 최대 구매 가능가 (= 자기자본 + 대출)
  appliedLtv: number // 적용된 LTV
  binding: 'LTV' | 'DSR' | 'HARD_CAP' // 한도를 결정한 제약
  dsrLoanCapWon: number // DSR로 산출된 대출 상한
  monthlyPaymentCapWon: number // 월 상환 여력
}

// 원리금 균등상환 역산: 월 상환 여력 → 대출 원금
// principal = pay * (1 - (1+i)^-n) / i
function loanFromMonthlyPayment(monthlyPay: number, annualRate: number, termYears: number): number {
  const i = annualRate / 12
  const n = termYears * 12
  if (monthlyPay <= 0) return 0
  if (i === 0) return monthlyPay * n
  return (monthlyPay * (1 - Math.pow(1 + i, -n))) / i
}

// 특정 지역코드가 규제지역인지
export function isRegulated(lawdCode: string, policy: PolicyRule): boolean {
  return policy.regulatedCodes.includes(lawdCode)
}

// 특정 지역(규제 여부)에 대해 적용 LTV 결정
function resolveLtv(regulated: boolean, profile: UserProfile, policy: PolicyRule): number {
  if (profile.isFirstTime && profile.ownedHouses === 0) return policy.ltv.firstTime
  return regulated ? policy.ltv.regulated : policy.ltv.nonRegulated
}

// 사용자의 대출 여력(DSR 기준 상한)을 계산. 규제 여부에 따라 스트레스 금리 차등.
export function dsrLoanCap(profile: UserProfile, policy: PolicyRule, regulated: boolean) {
  // 스트레스 DSR: 한도 산정용 금리 = 기준 + 스트레스(규제/비규제 차등)
  const stress = regulated ? policy.stressRateRegulated : policy.stressRateNonRegulated
  const stressedRate = policy.baseLoanRate + stress
  // 연간 상환 여력 = 소득*DSR한도 - 기존부채 원리금
  const annualCapacity = profile.annualIncomeWon * policy.dsrLimit - profile.existingAnnualDebtPaymentWon
  const monthlyCapacity = Math.max(0, annualCapacity / 12)
  const loan = loanFromMonthlyPayment(monthlyCapacity, stressedRate, policy.maxTermYears)
  return { loanWon: Math.max(0, loan), monthlyCapacity, stressedRate }
}

// 주택가격 구간별 주담대 절대 한도(원)
export function hardCapForPrice(priceWon: number, policy: PolicyRule): number {
  for (const t of policy.loanCapTiers) {
    if (priceWon <= t.maxPriceWon) return t.capWon
  }
  return policy.loanCapTiers[policy.loanCapTiers.length - 1]?.capWon ?? Infinity
}

// 핵심: 규제 여부에 따른 최대 구매가/대출 계산
// 대출한도가 주택가격 구간(6억/4억/2억)에 따라 달라지므로 이분탐색으로 최대가를 구한다.
//   조건: price ≤ cash + min(price*LTV, dsrCap, hardCap(price))
export function computeAffordability(
  profile: UserProfile,
  policy: PolicyRule,
  regulated: boolean
): AffordabilityResult {
  const ltv = resolveLtv(regulated, profile, policy)
  const { loanWon: dsrCap, monthlyCapacity } = dsrLoanCap(profile, policy, regulated)
  const cash = Math.max(0, profile.cashAssetsWon)

  const loanAt = (price: number) => Math.min(price * ltv, dsrCap, hardCapForPrice(price, policy))
  const feasible = (price: number) => cash + loanAt(price) >= price

  // 이분탐색 상한: 자기자본 + 가능한 최대 대출(가장 큰 구간 한도와 DSR 중 큰 값)
  const maxCap = Math.max(dsrCap, ...policy.loanCapTiers.map((t) => t.capWon))
  let lo = 0
  let hi = cash + maxCap + 1
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2
    if (feasible(mid)) lo = mid
    else hi = mid
  }
  const maxPrice = lo
  const cap = hardCapForPrice(maxPrice, policy)
  const ltvLoan = maxPrice * ltv
  const maxLoan = Math.min(ltvLoan, dsrCap, cap)

  // 한도를 결정한 제약 판별(최소값 기준)
  let binding: AffordabilityResult['binding'] = 'LTV'
  if (dsrCap <= ltvLoan && dsrCap <= cap) binding = 'DSR'
  else if (cap <= ltvLoan && cap <= dsrCap) binding = 'HARD_CAP'

  return {
    maxLoanWon: Math.round(maxLoan),
    maxPriceWon: Math.round(maxPrice),
    appliedLtv: ltv,
    binding,
    dsrLoanCapWon: Math.round(dsrCap),
    monthlyPaymentCapWon: Math.round(monthlyCapacity),
  }
}

// 보기 좋게 "억/만원" 포맷
export function formatWon(won: number): string {
  if (!isFinite(won)) return '-'
  const eok = Math.floor(won / 100_000_000)
  const man = Math.round((won % 100_000_000) / 10_000)
  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString()}만원`
  if (eok > 0) return `${eok}억원`
  return `${man.toLocaleString()}만원`
}
