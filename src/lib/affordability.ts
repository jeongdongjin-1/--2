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

// 사용자의 대출 여력(DSR 기준 상한)을 계산. 지역 무관.
export function dsrLoanCap(profile: UserProfile, policy: PolicyRule) {
  // 스트레스 DSR: 한도 산정용 금리 = 기준 + 스트레스
  const stressedRate = policy.baseLoanRate + policy.stressRate
  // 연간 상환 여력 = 소득*DSR한도 - 기존부채 원리금
  const annualCapacity = profile.annualIncomeWon * policy.dsrLimit - profile.existingAnnualDebtPaymentWon
  const monthlyCapacity = Math.max(0, annualCapacity / 12)
  const loan = loanFromMonthlyPayment(monthlyCapacity, stressedRate, policy.maxTermYears)
  return { loanWon: Math.max(0, loan), monthlyCapacity, stressedRate }
}

// 핵심: 규제 여부에 따른 최대 구매가/대출 계산
export function computeAffordability(
  profile: UserProfile,
  policy: PolicyRule,
  regulated: boolean
): AffordabilityResult {
  const ltv = resolveLtv(regulated, profile, policy)
  const { loanWon: dsrCap, monthlyCapacity } = dsrLoanCap(profile, policy)

  // 대출 상한 = min(DSR 한도, 정책 절대 한도)
  let loanCap = dsrCap
  let binding: AffordabilityResult['binding'] = 'DSR'
  if (policy.loanHardCapWon != null && policy.loanHardCapWon < loanCap) {
    loanCap = policy.loanHardCapWon
    binding = 'HARD_CAP'
  }

  // LTV가 가격에 비례하므로 max price 풀이:
  //   price = cash + min(price*LTV, loanCap)
  // LTV가 binding일 때: price = cash / (1 - LTV), loan = price*LTV
  const cash = Math.max(0, profile.cashAssetsWon)
  const priceIfLtvBinds = ltv < 1 ? cash / (1 - ltv) : Infinity
  const loanAtThatPrice = priceIfLtvBinds * ltv

  let maxPrice: number
  let maxLoan: number
  if (loanAtThatPrice <= loanCap) {
    // LTV가 먼저 막음
    maxPrice = priceIfLtvBinds
    maxLoan = loanAtThatPrice
    binding = 'LTV'
  } else {
    // DSR 또는 절대한도가 먼저 막음 — 대출은 loanCap로 고정
    maxLoan = loanCap
    maxPrice = cash + loanCap
    // binding은 위에서 DSR/HARD_CAP로 이미 설정됨
  }

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
