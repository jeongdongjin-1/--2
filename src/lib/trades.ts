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

// 이번 달 → 지난달 → 지지난달 순으로 거래가 있는 첫 달을 반환.
// 실데이터(molit)가 있으면 즉시 채택. 전부 비면 마지막 응답을 반환.
export async function fetchLatestTrades(lawd: string, type: PropType): Promise<TradesResponse & { probed: boolean }> {
  let last: TradesResponse | null = null
  for (let off = 0; off <= 2; off++) {
    const ymd = ymWithOffset(off)
    try {
      const r = await fetchTradesYmd(lawd, ymd, type)
      last = r
      if (r.count > 0) return { ...r, probed: true }
    } catch {
      // 다음 달로
    }
  }
  return { ...(last ?? { source: 'mock', type, lawdCode: lawd, dealYmd: ymWithOffset(1), count: 0, items: [] }), probed: true }
}
