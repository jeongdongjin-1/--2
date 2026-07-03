// 위경도 거리 계산 (하버사인, km)
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// 근무지 저장 (localStorage)
export type Workplace = { label: string; place: string; lat: number; lng: number }
const WP_KEY = 'budongsan.workplace.v1'

export function loadWorkplace(): Workplace | null {
  try {
    const raw = localStorage.getItem(WP_KEY)
    return raw ? (JSON.parse(raw) as Workplace) : null
  } catch {
    return null
  }
}

export function saveWorkplace(wp: Workplace | null) {
  if (wp) localStorage.setItem(WP_KEY, JSON.stringify(wp))
  else localStorage.removeItem(WP_KEY)
}
