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

// 네이버 부동산 — 좌표가 있으면 해당 위치 지도를 바로 열고(무조건 매칭), 없으면 동+정리된 이름 검색
export function naverLandUrl(opts: { dong?: string; name: string; lat?: number; lng?: number }): string {
  if (opts.lat != null && opts.lng != null) {
    return `https://new.land.naver.com/complexes?ms=${opts.lat},${opts.lng},17`
  }
  const q = `${opts.dong ?? ''} ${cleanAptName(opts.name)}`.trim()
  return `https://new.land.naver.com/search?query=${encodeURIComponent(q)}`
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
