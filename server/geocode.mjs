// 주소/단지명 → 좌표 지오코딩 (카카오 로컬 키워드 검색).
// KAKAO_REST_KEY가 있으면 정확한 좌표, 없으면 null(클라이언트가 구 중심 주변에 근사 배치).
// 성공 결과만 캐시한다(실패를 캐시하면 카카오맵 활성화 전 실패가 계속 남음).

const cache = new Map()

export async function geocode(query, kakaoKey) {
  if (!query) return null
  if (cache.has(query)) return cache.get(query) // 성공 결과만 들어있음
  if (!kakaoKey) return null
  try {
    const url =
      'https://dapi.kakao.com/v2/local/search/keyword.json?size=1&query=' +
      encodeURIComponent(query)
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${kakaoKey}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null // 실패는 캐시하지 않음 → 다음에 재시도
    const json = await res.json()
    const d = json.documents?.[0]
    if (!d) return null
    const r = { lat: Number(d.y), lng: Number(d.x), place: d.place_name, precise: true }
    cache.set(query, r) // 성공만 캐시
    return r
  } catch {
    return null
  }
}
