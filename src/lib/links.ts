// 외부 서비스(네이버 부동산·카카오맵) 딥링크 생성.
// 국토부 단지명은 "(891-26)" 같은 괄호 지번·부가표기가 붙어 그대로 검색하면 매칭 실패.
//  → 이름은 괄호 제거, 카카오는 지번 주소 우선(정확히 그 건물), 좌표 있으면 네이버는 지도 좌표로.
// (검증: 카카오 주소검색 '대치동 891-26' → 정확 1건, 키워드 '대치동 대우아이빌멤버스' → 해당 단지 최상위)

export function cleanAptName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, ' ') // 괄호 그룹 제거: (891-26), (1단지) 등
    .replace(/\s+/g, ' ')
    .trim()
}

// 네이버 부동산 — 좌표가 있으면 "해당 위치 중앙 + 단지명 검색 패널"을 함께 열어
// 어느 단지인지 바로 표시되게 한다(search?ms=좌표&query=단지명). 없으면 동+정리명 검색.
export function naverLandUrl(opts: { dong?: string; name: string; lat?: number; lng?: number }): string {
  const q = `${opts.dong ?? ''} ${cleanAptName(opts.name)}`.trim()
  if (opts.lat != null && opts.lng != null) {
    return `https://new.land.naver.com/search?ms=${opts.lat},${opts.lng},18&query=${encodeURIComponent(q)}`
  }
  return `https://new.land.naver.com/search?query=${encodeURIComponent(q)}`
}

// 클릭 시점 정밀 열기 — 지오코딩(서버 캐시)을 거쳐 네이버는 단지 좌표로, 카카오는 단지 페이지로 직행.
// 팝업 차단을 피하려고 사용자 제스처 안에서 창을 먼저 열고(location 나중 설정) 실패 시 폴백 URL 사용.
export async function openPreciseLink(
  kind: 'naver' | 'kakao',
  query: string, // 지오코딩 검색어: "강남구 대우아이빌멤버스" 형태
  fallbackUrl: string
) {
  const w = window.open('about:blank', '_blank', 'noopener')
  let url = fallbackUrl
  try {
    const r = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(3000),
    })
    const j = await r.json()
    if (j.result?.precise) {
      if (kind === 'naver') {
        // 좌표 중앙 + 검색 패널에 단지명 표시 → 어느 단지인지 창에서 바로 확인 가능
        url = `https://new.land.naver.com/search?ms=${j.result.lat},${j.result.lng},18&query=${encodeURIComponent(query)}`
      } else if (j.result.placeUrl) url = j.result.placeUrl
    }
  } catch {
    // 지오코딩 실패 → 폴백 URL 그대로
  }
  if (w) w.location.href = url
  else window.open(url, '_blank', 'noopener') // 창 선오픈이 막힌 경우
}

// 카카오맵 — 지오코딩된 장소 페이지 > 지번 주소 검색 > 동+이름 검색 순으로 정확도 우선
export function kakaoMapUrl(opts: {
  regionName?: string
  dong?: string
  jibun?: string
  name: string
  placeUrl?: string | null
}): string {
  if (opts.placeUrl) return opts.placeUrl
  if (opts.jibun && opts.dong) {
    const q = `${opts.regionName ?? ''} ${opts.dong} ${opts.jibun}`.trim()
    return `https://map.kakao.com/?q=${encodeURIComponent(q)}`
  }
  const q = `${opts.dong ?? opts.regionName ?? ''} ${cleanAptName(opts.name)}`.trim()
  return `https://map.kakao.com/?q=${encodeURIComponent(q)}`
}
