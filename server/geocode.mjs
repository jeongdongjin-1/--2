// 주소/단지명 → 좌표 지오코딩 (카카오 로컬 키워드 검색).
// KAKAO_REST_KEY가 있으면 정확한 좌표, 없으면 null(클라이언트가 구 중심 주변에 근사 배치).
// 성공 결과만 캐시하며, 파일에 영속화해 서버 재시작·중복 호출을 줄인다.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(__dirname, '.cache')
const CACHE_FILE = join(CACHE_DIR, 'geocode.json')

// 파일에서 캐시 로드(성공 결과만 저장돼 있음)
const cache = new Map()
try {
  if (existsSync(CACHE_FILE)) {
    const obj = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
    for (const [k, v] of Object.entries(obj)) cache.set(k, v)
    console.log(`[geocode] 캐시 ${cache.size}건 로드`)
  }
} catch {}

let writeTimer = null
function scheduleWrite() {
  if (writeTimer) return
  writeTimer = setTimeout(() => {
    writeTimer = null
    try {
      if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
      writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache)))
    } catch {}
  }, 2000)
}

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
    scheduleWrite()
    return r
  } catch {
    return null
  }
}
