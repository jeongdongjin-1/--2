// ──────────────────────────────────────────────────────────────────────────
// 청약 vs 매매 전략 분석
//   - 매매 루트: 개인 자금으로 지금 살 수 있는 최대가(affordability 재사용)
//   - 청약 루트: 해당 특별공급 + 정책대출로 감당 가능한 분양가(≈시세 환산)
//   - 성향(시간 여유형/자금 여유형)에 따라 추천
// ──────────────────────────────────────────────────────────────────────────
import { computeAffordabilityWithCosts, type UserProfile } from './affordability'
import type { PurchaseCosts } from './costs'
import { householdsOf } from './eligibility'
import { LOAN_PRODUCTS, type Household } from '../data/benefits'
import type { PolicyRule } from '../data/policy'

// 분양가는 통상 시세보다 저렴(분양가상한제 등). 시세 환산용 가정 계수.
export const PRESALE_DISCOUNT = 0.85 // 분양가 ≈ 시세의 85% (가정)

export type Priority = 'time' | 'money' | 'compare'

export type BuyRoute = {
  maxPriceRegulatedWon: number // 규제지역 기준
  maxPriceNonRegulatedWon: number // 비규제 기준
  ownCapitalWon: number // 필요 자기자본(= 현금 전액)
  loanWon: number // 대출액(비규제 기준)
  binding: string
  costs: PurchaseCosts // 비규제 최대가 기준 취득비용(취득세·중개보수 등)
}

export type SubscribeRoute = {
  eligible: boolean // 특별공급 정책대출 자격 있는지
  households: Household[]
  productName?: string
  productRate?: string
  loanLimitWon: number
  targetPriceWon: number
  affordablePresaleWon: number // 감당 가능 분양가
  marketValueEquivWon: number // 분양가의 시세 환산가치
  ownCapitalWon: number // 필요 자기자본(분양가 - 정책대출)
}

export type StrategyResult = {
  buy: BuyRoute
  subscribe: SubscribeRoute
  tips: { title: string; body: string }[] // 가구 유형별 전략 팁
  recommendation: {
    pick: 'subscribe' | 'buy' | 'both'
    headline: string
    reasons: string[]
  }
}

const HH_TIPS: Record<Household, { title: string; body: string }> = {
  newborn: {
    title: '👶 신생아 가구 — 청약이 가장 유리',
    body: '신생아 특별공급은 신설 유형이라 경쟁률이 상대적으로 낮고, 신생아 특례 대출은 최저 1%대로 전체 상품 중 금리가 가장 낮습니다. 청약 우선 전략을 강력 추천.',
  },
  newlywed: {
    title: '💍 신혼부부 — 청약 특공 + 저리 대출',
    body: '신혼부부 특별공급(민영 18%·국민 30% 내외) 물량이 별도로 있고, 신혼 디딤돌로 저리 대출이 가능합니다. 혼인 7년 이내·자녀 수·청약통장 기간이 가점에 유리.',
  },
  multichild: {
    title: '👨‍👩‍👧‍👦 다자녀 — 배점제로 당첨 유리',
    body: '다자녀 특별공급은 배점제라 미성년 자녀가 많을수록 유리하고, 다자녀 우대금리(2자녀 0.5%p·3자녀 0.7%p)로 이자 부담이 줄어듭니다.',
  },
}

export function analyzeStrategy(
  profile: UserProfile,
  policy: PolicyRule,
  priority: Priority
): StrategyResult {
  const cash = Math.max(0, profile.cashAssetsWon)

  // ── 매매 루트 (취득세·중개보수 등 부대비용 반영) ──
  const buyReg = computeAffordabilityWithCosts(profile, policy, true)
  const buyNon = computeAffordabilityWithCosts(profile, policy, false)
  const buy: BuyRoute = {
    maxPriceRegulatedWon: buyReg.maxPriceWon,
    maxPriceNonRegulatedWon: buyNon.maxPriceWon,
    ownCapitalWon: cash,
    loanWon: buyNon.maxLoanWon,
    binding: buyNon.binding,
    costs: buyNon.costs,
  }

  // ── 청약 루트 ── 해당 특별공급 구입자금 상품 중 한도 큰 것
  const hh = householdsOf(profile)
  const eligibleProducts = LOAN_PRODUCTS.filter(
    (p) =>
      p.category === '구입자금' &&
      p.households.some((h) => hh.includes(h)) &&
      profile.annualIncomeWon <= p.incomeLimitWon
  ).sort((a, b) => b.loanLimitWon - a.loanLimitWon)
  const best = eligibleProducts[0]

  let subscribe: SubscribeRoute
  if (best) {
    const affordablePresale = Math.min(cash + best.loanLimitWon, best.targetPriceWon)
    const loanUsed = Math.max(0, affordablePresale - cash)
    subscribe = {
      eligible: true,
      households: hh,
      productName: best.name,
      productRate: best.rate.split('(')[0].trim(),
      loanLimitWon: best.loanLimitWon,
      targetPriceWon: best.targetPriceWon,
      affordablePresaleWon: affordablePresale,
      marketValueEquivWon: Math.round(affordablePresale / PRESALE_DISCOUNT),
      ownCapitalWon: affordablePresale - loanUsed,
    }
  } else {
    subscribe = {
      eligible: false,
      households: hh,
      loanLimitWon: 0,
      targetPriceWon: 0,
      affordablePresaleWon: 0,
      marketValueEquivWon: 0,
      ownCapitalWon: 0,
    }
  }

  // ── 가구 유형별 팁 ──
  const tips = hh.map((h) => HH_TIPS[h])

  // ── 추천 ──
  const cashRich = cash >= buyNon.maxPriceWon * 0.5
  const subBetter =
    subscribe.eligible && subscribe.marketValueEquivWon >= buyNon.maxPriceWon

  let pick: 'subscribe' | 'buy' | 'both'
  const reasons: string[] = []

  if (subscribe.eligible && (priority === 'time' || (priority !== 'money' && subBetter))) {
    pick = 'subscribe'
    reasons.push('특별공급 자격이 있어 경쟁률·분양가에서 유리합니다.')
    if (subBetter)
      reasons.push('청약(분양가 시세환산)이 매매 최대가보다 크거나 비슷 — 같은 돈으로 더 좋은 집이 가능.')
    reasons.push('정책대출이 저리라 이자 부담이 매매(시중금리)보다 작습니다.')
    reasons.push('단, 당첨 불확실성과 입주까지 대기(보통 2~3년)를 감수해야 합니다.')
  } else if (priority === 'money' || cashRich || !subscribe.eligible) {
    pick = 'buy'
    if (cashRich) reasons.push('자기자본이 충분해 원하는 시점에 바로 매수·입주할 수 있습니다.')
    if (priority === 'money') reasons.push('빠른 입주를 우선하는 성향에 매매가 맞습니다.')
    if (!subscribe.eligible)
      reasons.push('현재 특별공급 정책대출 자격이 없어(무주택·가구요건·소득요건 확인) 매매가 현실적입니다. 생애최초·일반공급 청약은 병행 검토 가능.')
    reasons.push('매물 선택 자유·즉시 입주가 장점이며, 청약통장·무주택 유지 부담이 없습니다.')
  } else {
    pick = 'both'
    reasons.push('청약(저렴·대기)과 매매(즉시·자유)의 장단이 비슷 — 청약을 넣어두고 매매도 병행 탐색하는 투트랙이 안전합니다.')
  }

  const headline =
    pick === 'subscribe'
      ? '🎯 청약(분양) 우선 전략을 추천합니다'
      : pick === 'buy'
        ? '🏠 매매 우선 전략을 추천합니다'
        : '🔀 청약 + 매매 투트랙을 추천합니다'

  return { buy, subscribe, tips, recommendation: { pick, headline, reasons } }
}
