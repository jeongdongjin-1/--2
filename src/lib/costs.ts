// ──────────────────────────────────────────────────────────────────────────
// 주택 매수 부대비용 계산 — 취득세·지방교육세·농어촌특별세·중개보수·인지세
//
// 기준(주택 유상취득, 2024~ 통용 골격 — 참고용):
//  · 취득세(1주택): 6억↓ 1% / 6~9억 (가격(억)×2/3−3)% 선형 / 9억↑ 3%
//  · 다주택 중과: 조정대상지역 2주택째 8%, 3주택 이상 12%
//                 비조정 2주택째 일반세율, 3주택째 8%, 4주택 이상 12%
//  · 지방교육세: 일반 = 취득세율×0.1 / 중과(8·12%) = 0.4%
//  · 농어촌특별세(전용 85㎡ 초과): 일반 0.2% / 8% 중과 0.6% / 12% 중과 1.0%
//  · 생애최초 감면: 12억 이하 주택 취득세 최대 200만원 감면
//  · 인지세: 1억↓ 7만 / 1~10억 15만 / 10억↑ 35만
//  · 중개보수 상한: 5천만↓ 0.6%(25만 한도) / ~2억 0.5%(80만 한도) / ~9억 0.4%
//                  / ~12억 0.5% / ~15억 0.6% / 15억↑ 0.7% (VAT 별도)
// 세율·감면은 지방세특례 개정으로 바뀔 수 있어 disclaimer와 함께 사용할 것.
// ──────────────────────────────────────────────────────────────────────────

export type CostInput = {
  priceWon: number
  ownedHouses: number // 현재 보유 주택 수 (이번 매수는 ownedHouses+1번째 주택)
  regulated: boolean // 조정대상지역 여부
  isFirstTime: boolean // 생애최초(감면 대상) 여부
  over85: boolean // 전용 85㎡ 초과 여부(농특세)
}

export type PurchaseCosts = {
  acqRate: number // 적용 취득세율
  acquisitionTax: number
  firstTimeDiscount: number // 생애최초 감면액(차감분)
  eduTax: number // 지방교육세
  ruralTax: number // 농어촌특별세
  brokerFee: number // 중개보수(상한 기준)
  stampDuty: number // 인지세
  total: number
}

// 1주택 일반 취득세율
function basicAcqRate(priceWon: number): number {
  const eok = priceWon / 100_000_000
  if (eok <= 6) return 0.01
  if (eok <= 9) return ((eok * 2) / 3 - 3) / 100 // 6~9억 선형(1~3%)
  return 0.03
}

// 취득세율(중과 포함). 이번 매수 후 보유 수 = ownedHouses+1
function acqRate(priceWon: number, ownedHouses: number, regulated: boolean): number {
  const nth = ownedHouses + 1
  if (regulated) {
    if (nth >= 3) return 0.12
    if (nth === 2) return 0.08
    return basicAcqRate(priceWon)
  }
  if (nth >= 4) return 0.12
  if (nth === 3) return 0.08
  return basicAcqRate(priceWon) // 비조정 1·2주택은 일반세율
}

function brokerFeeOf(priceWon: number): number {
  const p = priceWon
  if (p < 50_000_000) return Math.min(p * 0.006, 250_000)
  if (p < 200_000_000) return Math.min(p * 0.005, 800_000)
  if (p < 900_000_000) return p * 0.004
  if (p < 1_200_000_000) return p * 0.005
  if (p < 1_500_000_000) return p * 0.006
  return p * 0.007
}

function stampDutyOf(priceWon: number): number {
  if (priceWon <= 100_000_000) return 70_000
  if (priceWon <= 1_000_000_000) return 150_000
  return 350_000
}

export function purchaseCosts(input: CostInput): PurchaseCosts {
  const { priceWon, ownedHouses, regulated, isFirstTime, over85 } = input
  if (priceWon <= 0) {
    return { acqRate: 0, acquisitionTax: 0, firstTimeDiscount: 0, eduTax: 0, ruralTax: 0, brokerFee: 0, stampDuty: 0, total: 0 }
  }

  const rate = acqRate(priceWon, ownedHouses, regulated)
  let acquisitionTax = priceWon * rate

  // 생애최초 감면(12억 이하, 최대 200만원) — 무주택 첫 취득만
  let firstTimeDiscount = 0
  if (isFirstTime && ownedHouses === 0 && priceWon <= 1_200_000_000) {
    firstTimeDiscount = Math.min(acquisitionTax, 2_000_000)
    acquisitionTax -= firstTimeDiscount
  }

  // 지방교육세: 일반 = 세율×0.1, 중과(8/12%) = 0.4% 고정
  const eduTax = priceWon * (rate >= 0.08 ? 0.004 : rate * 0.1)

  // 농특세: 85㎡ 초과 시 — 일반 0.2%, 8%중과 0.6%, 12%중과 1.0%
  const ruralTax = over85 ? priceWon * (rate >= 0.12 ? 0.01 : rate >= 0.08 ? 0.006 : 0.002) : 0

  const brokerFee = brokerFeeOf(priceWon)
  const stampDuty = stampDutyOf(priceWon)

  const total = acquisitionTax + eduTax + ruralTax + brokerFee + stampDuty
  return {
    acqRate: rate,
    acquisitionTax: Math.round(acquisitionTax),
    firstTimeDiscount: Math.round(firstTimeDiscount),
    eduTax: Math.round(eduTax),
    ruralTax: Math.round(ruralTax),
    brokerFee: Math.round(brokerFee),
    stampDuty,
    total: Math.round(total),
  }
}
