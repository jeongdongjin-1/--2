// 주소/단지명 → 좌표 지오코딩 (카카오 로컬 키워드 검색).
// KAKAO_REST_KEY가 있으면 정확한 좌표, 없으면 null(클라이언트가 구 중심 주변에 근사 배치).
// 동일 쿼리는 메모리 캐시.

const cache = new Map()

export async function geocode(query, kakaoKey) {
  if (!query) return null
  if (cache.has(query)) return cache.get(query)
  if (!kakaoKey) {
    cache.set(query, null)
    return null
  }
  try {
    const url =
      'https://dapi.kakao.com/v2/local/search/keyword.json?size=1&query=' +
      encodeURIComponent(query)
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${kakaoKey}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      cache.set(query, null)
      return null
    }
    const json = await res.json()
    const d = json.documents?.[0]
    if (!d) {
      cache.set(query, null)
      return null
    }
    const r = { lat: Number(d.y), lng: Number(d.x), place: d.place_name, precise: true }
    cache.set(query, r)
    return r
  } catch {
    cache.set(query, null)
    return null
  }
}
