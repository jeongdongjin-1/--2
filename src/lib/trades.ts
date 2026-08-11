// 실거래가 조회 공용 헬퍼 — "데이터가 있는 가장 최신 달"을 자동으로 찾는다.
// 실거래 신고는 계약 후 30일 이내라 이번 달 데이터가 부분적으로만 존재 →
// 이번 달부터 최대 3개월 거슬러 내려가며 거래가 있는 첫 달을 쓴다(매일 최신 반영).

export type PropType = 'apt' | 'offi' | 'villa'

export function ymWithOffset(monthsAgo: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
}

export type TradesResponse = {
  source: string
  reason?: string
  type: string
  lawdCode: string
  dealYmd: string
  count: number
  items: any[]
}

export async function fetchTradesYmd(lawd: string, ymd: string, type: PropType): Promise<TradesResponse> {
  const res = await fetch(`/api/trades?lawd=${lawd}&ymd=${ymd}&type=${type}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '조회 실패')
  return json
}

// 이번 달 → 지난달 → 지지난달 순으로 거래가 있는 달을 찾는다.
// 실거래 신고는 계약 후 30일 이내라 이번 달 데이터는 며칠치만 있는 경우가 많음 →
// 최신 달 거래가 적으면(20건 미만) 직전 달과 합쳐서 보여준다(mergedYmds에 표시).
export async function fetchLatestTrades(
  lawd: string,
  type: PropType
): Promise<TradesResponse & { probed: boolean; mergedYmds?: string[] }> {
  const found: TradesResponse[] = []
  let last: TradesResponse | null = null
  for (let off = 0; off <= 3 && found.length < 2; off++) {
    const ymd = ymWithOffset(off)
    try {
      const r = await fetchTradesYmd(lawd, ymd, type)
      last = r
      if (r.count > 0) found.push(r)
      // 최신 달에 거래가 충분하면 더 찾을 필요 없음
      if (found.length === 1 && r.count >= 20) break
    } catch {
      // 다음 달로
    }
  }
  if (found.length === 0) {
    return { ...(last ?? { source: 'mock', type, lawdCode: lawd, dealYmd: ymWithOffset(1), count: 0, items: [] }), probed: true }
  }
  const newest = found[0]
  if (newest.count >= 20 || found.length === 1) return { ...newest, probed: true }
  // 최신 달이 빈약하면 직전 달과 합산(카드는 단지·평형별 최신 거래만 남으므로 안전)
  const older = found[1]
  return {
    ...newest,
    count: newest.items.length + older.items.length,
    items: [...newest.items, ...older.items],
    probed: true,
    mergedYmds: [older.dealYmd, newest.dealYmd], // 과거 → 최신
  }
}
