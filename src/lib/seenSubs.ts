// 청약 공고 '본 것' 추적 — 마지막 방문 이후 새 공고를 하이라이트하기 위함.
const KEY = 'budongsan.seenSubs.v1'
const MAX = 300

export function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function markSeen(hmNos: string[]) {
  const set = loadSeen()
  hmNos.forEach((h) => h && set.add(h))
  localStorage.setItem(KEY, JSON.stringify([...set].slice(-MAX)))
}
