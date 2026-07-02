import { describe, it, expect } from 'vitest'
import { purchaseCosts } from './costs'
import { computeAffordabilityWithCosts, type UserProfile } from './affordability'
import type { PolicyRule } from '../data/policy'

const base = { ownedHouses: 0, regulated: false, isFirstTime: false, over85: false }

describe('purchaseCosts — 취득세율 구간', () => {
  it('6억 이하 1%', () => {
    const c = purchaseCosts({ ...base, priceWon: 500_000_000 })
    expect(c.acqRate).toBeCloseTo(0.01, 5)
    expect(c.acquisitionTax).toBe(5_000_000)
  })
  it('7.5억 → 2% (6~9억 선형)', () => {
    const c = purchaseCosts({ ...base, priceWon: 750_000_000 })
    expect(c.acqRate).toBeCloseTo(0.02, 4)
  })
  it('9억 초과 3%', () => {
    const c = purchaseCosts({ ...base, priceWon: 1_000_000_000 })
    expect(c.acqRate).toBeCloseTo(0.03, 5)
  })
  it('조정지역 2주택째 8% 중과 + 교육세 0.4%', () => {
    const c = purchaseCosts({ ...base, priceWon: 500_000_000, ownedHouses: 1, regulated: true })
    expect(c.acqRate).toBeCloseTo(0.08, 5)
    expect(c.eduTax).toBe(2_000_000) // 0.4%
  })
  it('비조정 2주택째는 일반세율', () => {
    const c = purchaseCosts({ ...base, priceWon: 500_000_000, ownedHouses: 1 })
    expect(c.acqRate).toBeCloseTo(0.01, 5)
  })
})

describe('purchaseCosts — 감면·부대비', () => {
  it('생애최초 무주택 12억 이하 → 최대 200만원 감면', () => {
    const c = purchaseCosts({ ...base, priceWon: 500_000_000, isFirstTime: true })
    expect(c.firstTimeDiscount).toBe(2_000_000)
    expect(c.acquisitionTax).toBe(3_000_000) // 500만 - 200만
  })
  it('85㎡ 초과 시 농특세 0.2% 부과', () => {
    const c = purchaseCosts({ ...base, priceWon: 500_000_000, over85: true })
    expect(c.ruralTax).toBe(1_000_000)
  })
  it('중개보수 상한: 5억 → 0.4%', () => {
    const c = purchaseCosts({ ...base, priceWon: 500_000_000 })
    expect(c.brokerFee).toBe(2_000_000)
  })
  it('인지세: 10억 이하 15만', () => {
    expect(purchaseCosts({ ...base, priceWon: 500_000_000 }).stampDuty).toBe(150_000)
  })
})

// 비용 포함 최대가: 불변식 price + costs ≈ cash + loan
const POLICY: PolicyRule = {
  effectiveDate: 't', note: 't', sources: [],
  dsrLimit: 0.4, stressRateRegulated: 0.03, stressRateNonRegulated: 0.015,
  baseLoanRate: 0.043, maxTermYears: 30,
  ltv: { regulated: 0.4, nonRegulated: 0.7, firstTime: 0.8 },
  loanCapTiers: [
    { maxPriceWon: 1_500_000_000, capWon: 600_000_000 },
    { maxPriceWon: 2_500_000_000, capWon: 400_000_000 },
    { maxPriceWon: Infinity, capWon: 200_000_000 },
  ],
  regulatedCodes: [],
}
const PROFILE: UserProfile = {
  annualIncomeWon: 60_000_000, cashAssetsWon: 200_000_000, existingAnnualDebtPaymentWon: 0,
  isFirstTime: true, ownedHouses: 0, marriedWithin7yr: false, newbornWithin2yr: false, childrenCount: 0,
}

describe('computeAffordabilityWithCosts', () => {
  it('비용 포함 최대가는 미포함보다 작다', () => {
    const withCosts = computeAffordabilityWithCosts(PROFILE, POLICY, true)
    // 미포함 = costs 0인 상태와 비교 위해 ownedHouses 등 동일
    expect(withCosts.maxPriceWon).toBeGreaterThan(0)
    expect(withCosts.costs.total).toBeGreaterThan(0)
    // 불변식: cash + loan ≈ price + costs (이분탐색 오차 허용)
    const lhs = PROFILE.cashAssetsWon + withCosts.maxLoanWon
    const rhs = withCosts.maxPriceWon + withCosts.costs.total
    expect(Math.abs(lhs - rhs)).toBeLessThan(10_000)
  })
})
