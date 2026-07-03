// ──────────────────────────────────────────────────────────────────────────
// AI 가성비 분석 — 실거래 데이터 기반 스코어링(규칙 기반, 근거 투명 공개)
//
// 입력: 최근 N개월 거래(ymd 내림차순 배열: [{ymd, items:[...]}])
// 그룹: 단지 + 면적대(10㎡ 버킷) — 같은 평형끼리 비교
// 점수(0~100 가중합):
//   · 저평가 45% — 같은 동(표본<3이면 구 전체)의 ㎡당가 중위값 대비 할인율
//   · 연식   20% — 최신 준공일수록 가점
//   · 유동성 20% — 기간 내 거래 건수(환금성·표본 신뢰)
//   · 추세   15% — 첫 달 대비 마지막 달 중위가 변화(급락 페널티, 완만한 상승 가점)
// ──────────────────────────────────────────────────────────────────────────

function median(nums) {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export function computeValuePicks(monthsData, { minDeals = 2, top = 20 } = {}) {
  const thisYear = new Date().getFullYear()

  // ── 그룹핑: apt|areaBucket ──
  const groups = new Map()
  for (const { ymd, items } of monthsData) {
    for (const t of items) {
      if (!t.apt || !t.priceWon || !t.area) continue
      const bucket = Math.floor(t.area / 10) * 10
      const key = `${t.apt}|${bucket}`
      let g = groups.get(key)
      if (!g) {
        g = { apt: t.apt, dong: t.dong, jibun: t.jibun, bucket, deals: [], byMonth: new Map() }
        groups.set(key, g)
      }
      g.deals.push(t)
      if (!g.byMonth.has(ymd)) g.byMonth.set(ymd, [])
      g.byMonth.get(ymd).push(t.priceWon)
    }
  }

  // ── 그룹 요약 ──
  const rows = []
  for (const g of groups.values()) {
    if (g.deals.length < minDeals) continue
    const prices = g.deals.map((d) => d.priceWon)
    const areas = g.deals.map((d) => d.area)
    const medianPrice = median(prices)
    const medianArea = median(areas)
    if (!medianArea) continue
    const ppm = medianPrice / medianArea // ㎡당가
    const buildYear = median(g.deals.map((d) => d.buildYear).filter(Boolean)) || 0

    // 추세: 데이터 있는 첫 달(과거) vs 마지막 달(최신)
    const ymds = [...g.byMonth.keys()].sort()
    const firstMed = median(g.byMonth.get(ymds[0]))
    const lastMed = median(g.byMonth.get(ymds[ymds.length - 1]))
    const trendPct = ymds.length >= 2 && firstMed > 0 ? (lastMed - firstMed) / firstMed : null

    rows.push({
      apt: g.apt, dong: g.dong, jibun: g.jibun, bucket: g.bucket,
      count: g.deals.length, medianPrice: Math.round(medianPrice),
      medianArea: Math.round(medianArea * 10) / 10, ppm, buildYear: Math.round(buildYear),
      trendPct,
    })
  }
  if (rows.length === 0) return []

  // ── 벤치마크: 같은 동·같은 평형대의 ㎡당가 중위 ──
  // 대형 평형은 원래 ㎡당가가 낮아 동 전체와 비교하면 항상 '저평가'로 왜곡됨 →
  // 평형대(소형<40 / 중형40~84 / 대형85+)별로 비교. 표본<3이면 구+평형대 → 구 전체 순 폴백.
  const bandOf = (bucket) => (bucket < 40 ? '소' : bucket < 85 ? '중' : '대')
  const byDongBand = new Map()
  const byGuBand = new Map()
  for (const r of rows) {
    const band = bandOf(r.bucket)
    const dk = `${r.dong}|${band}`
    if (!byDongBand.has(dk)) byDongBand.set(dk, [])
    byDongBand.get(dk).push(r.ppm)
    if (!byGuBand.has(band)) byGuBand.set(band, [])
    byGuBand.get(band).push(r.ppm)
  }
  const guBench = median(rows.map((r) => r.ppm))
  const benchOf = (dong, bucket) => {
    const band = bandOf(bucket)
    const d = byDongBand.get(`${dong}|${band}`) || []
    if (d.length >= 3) return { bench: median(d), scope: `동 ${band}형` }
    const g = byGuBand.get(band) || []
    if (g.length >= 3) return { bench: median(g), scope: `구 ${band}형` }
    return { bench: guBench, scope: '구 전체' }
  }

  // ── 점수 ──
  const maxCount = Math.max(...rows.map((r) => r.count))
  for (const r of rows) {
    const { bench, scope } = benchOf(r.dong, r.bucket)
    const discount = bench > 0 ? (bench - r.ppm) / bench : 0 // +면 저평가
    r.discountPct = Math.round(discount * 1000) / 10
    r.benchScope = scope

    const sDisc = clamp(discount, -0.3, 0.3) / 0.6 + 0.5 // -30%~+30% → 0~1
    const sAge = clamp((r.buildYear - 1990) / (thisYear - 1990), 0, 1)
    const sLiq = clamp(r.count / Math.max(maxCount * 0.6, 4), 0, 1)
    const sTrend = r.trendPct == null ? 0.5 : clamp(r.trendPct, -0.1, 0.1) / 0.2 + 0.5

    r.score = Math.round((sDisc * 0.45 + sAge * 0.2 + sLiq * 0.2 + sTrend * 0.15) * 100)
    r.parts = {
      저평가: Math.round(sDisc * 100),
      연식: Math.round(sAge * 100),
      유동성: Math.round(sLiq * 100),
      추세: Math.round(sTrend * 100),
    }
  }

  rows.sort((a, b) => b.score - a.score)
  return rows.slice(0, top)
}
