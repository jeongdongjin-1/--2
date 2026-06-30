// 내 프로필 → 받을 수 있는 혜택/대출 자동 판정
import type { UserProfile } from './affordability'
import {
  HOUSEHOLD_INFO,
  LOAN_PRODUCTS,
  type Household,
  type HouseholdInfo,
  type LoanProduct,
} from '../data/benefits'

// 프로필에서 해당되는 가구 유형 도출
export function householdsOf(p: UserProfile): Household[] {
  const set = new Set<Household>()
  if (p.marriedWithin7yr) set.add('newlywed')
  if (p.newbornWithin2yr) set.add('newborn')
  if (p.childrenCount >= 2) set.add('multichild')
  return [...set]
}

export type EligibleProduct = {
  product: LoanProduct
  incomeOk: boolean // 소득 요건 충족 여부
  note: string
}

export type EligibilityResult = {
  households: Household[]
  matchedInfo: HouseholdInfo[]
  products: EligibleProduct[] // 가구 유형이 맞는 상품(소득 충족 여부 포함)
  hasAny: boolean
}

export function evaluateEligibility(p: UserProfile): EligibilityResult {
  const households = householdsOf(p)
  const matchedInfo = HOUSEHOLD_INFO.filter((h) => households.includes(h.key))

  const products: EligibleProduct[] = LOAN_PRODUCTS.filter((prod) =>
    prod.households.some((h) => households.includes(h))
  ).map((product) => {
    const incomeOk = p.annualIncomeWon <= product.incomeLimitWon
    return {
      product,
      incomeOk,
      note: incomeOk
        ? '소득 요건 충족'
        : `소득 ${Math.round(p.annualIncomeWon / 10_000).toLocaleString()}만원 > 상한 ${Math.round(product.incomeLimitWon / 10_000).toLocaleString()}만원`,
    }
  })

  return {
    households,
    matchedInfo,
    products,
    hasAny: households.length > 0,
  }
}
