import { describe, it, expect } from 'vitest'
import {
  computeAffordability,
  dsrLoanCap,
  hardCapForPrice,
  type UserProfile,
} from './affordability'
import type { PolicyRule } from '../data/policy'

// 테스트용 고정 정책(실제 policy.ts와 독립 — 값이 바뀌어도 테스트가 안 깨지게)
const POLICY: PolicyRule = {
  effectiveDate: '2025-10-16',
  note: 'test',
  sources: [],
  dsrLimit: 0.4,
  stressRateRegulated: 0.03,
  stressRateNonRegulated: 0.015,
  baseLoanRate: 0.043,
  maxTermYears: 30,
  ltv: { regulated: 0.4, nonRegulated: 0.7, firstTime: 0.8 },
  loanCapTiers: [
    { maxPriceWon: 1_500_000_000, capWon: 600_000_000 },
    { maxPriceWon: 2_500_000_000, capWon: 400_000_000 },
    { maxPriceWon: Infinity, capWon: 200_000_000 },
  ],
  regulatedCodes: ['11680'],
}

const base: UserProfile = {
  annualIncomeWon: 60_000_000,
  cashAssetsWon: 200_000_000,
  existingAnnualDebtPaymentWon: 0,
  isFirstTime: true,
  ownedHouses: 0,
  marriedWithin7yr: false,
  newbornWithin2yr: false,
  childrenCount: 0,
}

// 최대구매가 = 자기자본 + 대출 이라는 관계는 항상 성립해야 한다(핵심 불변식)
function checkInvariant(r: ReturnType<typeof computeAffordability>, cash: number) {
  expect(r.maxPriceWon).toBeCloseTo(cash + r.maxLoanWon, -4) // 원 단위 반올림 오차 허용
}

describe('hardCapForPrice — 가격 구간별 한도', () => {
  it('15억 이하 → 6억', () => {
    expect(hardCapForPrice(1_000_000_000, POLICY)).toBe(600_000_000)
    expect(hardCapForPrice(1_500_000_000, POLICY)).toBe(600_000_000)
  })
  it('15~25억 → 4억', () => {
    expect(hardCapForPrice(2_000_000_000, POLICY)).toBe(400_000_000)
  })
  it('25억 초과 → 2억', () => {
    expect(hardCapForPrice(3_000_000_000, POLICY)).toBe(200_000_000)
  })
})

describe('dsrLoanCap — 규제 여부에 따른 스트레스 차등', () => {
  it('규제지역 스트레스(3%)가 비규제(1.5%)보다 한도를 낮춘다', () => {
    const reg = dsrLoanCap(base, POLICY, true).loanWon
    const non = dsrLoanCap(base, POLICY, false).loanWon
    expect(reg).toBeLessThan(non)
    expect(reg).toBeGreaterThan(0)
  })
  it('월 상환 여력 = 연소득*DSR/12', () => {
    const { monthlyCapacity } = dsrLoanCap(base, POLICY, true)
    expect(monthlyCapacity).toBeCloseTo((60_000_000 * 0.4) / 12, 0)
  })
  it('기존부채가 소득*DSR를 초과하면 대출 0', () => {
    const p = { ...base, existingAnnualDebtPaymentWon: 100_000_000 }
    expect(dsrLoanCap(p, POLICY, true).loanWon).toBe(0)
  })
})

describe('computeAffordability — 최대 구매가', () => {
  it('불변식: maxPrice = cash + maxLoan', () => {
    const r = computeAffordability(base, POLICY, true)
    checkInvariant(r, base.cashAssetsWon)
  })

  it('규제지역 생애최초는 LTV 80% 적용', () => {
    const r = computeAffordability(base, POLICY, true)
    expect(r.appliedLtv).toBe(0.8)
  })

  it('유주택자는 규제지역 LTV 40%', () => {
    const p = { ...base, isFirstTime: false, ownedHouses: 1 }
    const r = computeAffordability(p, POLICY, true)
    expect(r.appliedLtv).toBe(0.4)
  })

  it('비규제 유주택자는 LTV 70%', () => {
    const p = { ...base, isFirstTime: false, ownedHouses: 1 }
    const r = computeAffordability(p, POLICY, false)
    expect(r.appliedLtv).toBe(0.7)
  })

  it('저소득(6천만)·현금 2억은 DSR이 한도를 결정', () => {
    const r = computeAffordability(base, POLICY, true)
    expect(r.binding).toBe('DSR')
    // 대략 4~5억대 (스트레스 3% 반영)
    expect(r.maxPriceWon).toBeGreaterThan(400_000_000)
    expect(r.maxPriceWon).toBeLessThan(550_000_000)
  })

  it('고소득·고자산은 절대한도(6억)에 막힌다', () => {
    const p = { ...base, annualIncomeWon: 300_000_000, cashAssetsWon: 800_000_000 }
    const r = computeAffordability(p, POLICY, true)
    expect(r.maxLoanWon).toBeLessThanOrEqual(600_000_000 + 1)
    expect(r.binding === 'HARD_CAP' || r.binding === 'LTV').toBe(true)
    checkInvariant(r, p.cashAssetsWon)
  })

  it('현금 0이면 최대가는 대출액과 같다', () => {
    const p = { ...base, cashAssetsWon: 0 }
    const r = computeAffordability(p, POLICY, true)
    expect(r.maxPriceWon).toBe(r.maxLoanWon)
  })

  it('단조성: 소득이 높을수록 최대 구매가가 크거나 같다', () => {
    const low = computeAffordability({ ...base, annualIncomeWon: 50_000_000 }, POLICY, true)
    const high = computeAffordability({ ...base, annualIncomeWon: 120_000_000 }, POLICY, true)
    expect(high.maxPriceWon).toBeGreaterThanOrEqual(low.maxPriceWon)
  })

  it('단조성: 현금이 많을수록 최대 구매가가 크거나 같다', () => {
    const a = computeAffordability({ ...base, cashAssetsWon: 100_000_000 }, POLICY, true)
    const b = computeAffordability({ ...base, cashAssetsWon: 500_000_000 }, POLICY, true)
    expect(b.maxPriceWon).toBeGreaterThan(a.maxPriceWon)
  })

  it('대출액은 결코 가격구간 한도를 넘지 않는다', () => {
    const p = { ...base, annualIncomeWon: 500_000_000, cashAssetsWon: 2_000_000_000 }
    const r = computeAffordability(p, POLICY, true)
    expect(r.maxLoanWon).toBeLessThanOrEqual(hardCapForPrice(r.maxPriceWon, POLICY) + 1)
  })
})
