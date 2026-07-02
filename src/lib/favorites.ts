// 관심 단지 즐겨찾기 — localStorage 저장(개인정보와 동일하게 브라우저에만).
export type FavItem = {
  key: string // apt|area|lawd|type
  apt: string
  area: number
  dong: string
  lawd: string
  regionName: string
  type: 'apt' | 'offi' | 'villa'
  savedPriceWon: number // 저장 시점 중위가(카드 가격)
  savedYmd: string // 저장 시점 데이터 연월
  savedAt: number
}

const KEY = 'budongsan.favorites.v1'
const MAX = 20

export function loadFavorites(): FavItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as FavItem[]) : []
  } catch {
    return []
  }
}

export function saveFavorites(list: FavItem[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
}

export function favKey(apt: string, area: number, lawd: string, type: string): string {
  return `${apt}|${area}|${lawd}|${type}`
}

export function toggleFavorite(item: FavItem): FavItem[] {
  const list = loadFavorites()
  const idx = list.findIndex((f) => f.key === item.key)
  if (idx >= 0) list.splice(idx, 1)
  else list.unshift(item)
  saveFavorites(list)
  return loadFavorites()
}
