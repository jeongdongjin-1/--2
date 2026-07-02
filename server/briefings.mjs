// 정책 브리핑 자동 수집 — 정부 보도자료 RSS를 주기적으로 가져와 부동산 관련만 필터.
// 소스: 국토교통부·금융위원회·대한민국 정책브리핑(korea.kr) 보도자료 RSS(공개 피드).
// 6시간 파일 캐시(서버 재시작에도 유지). 모든 소스 실패 시 빈 목록(클라이언트는 큐레이션 타임라인 유지).
import { XMLParser } from 'fast-xml-parser'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(__dirname, '.cache')
const CACHE_FILE = join(CACHE_DIR, 'briefings.json')
const TTL_MS = 6 * 60 * 60 * 1000 // 6시간

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true, cdataPropName: '__cdata' })

// RSS 소스 — korea.kr(정책브리핑) 부처별 공개 피드. 검증됨(2026-07):
//   부처 직접 RSS(molit.go.kr 307, fsc.go.kr 404)는 폐쇄되어 korea.kr 경유가 안정적.
const SOURCES = [
  { name: '국토교통부', url: 'https://www.korea.kr/rss/dept_molit.xml' },
  { name: '금융위원회', url: 'https://www.korea.kr/rss/dept_fsc.xml' },
  { name: '정책브리핑', url: 'https://www.korea.kr/rss/policy.xml' },
]

// 부동산 관련 키워드(제목 기준 필터) — '공급'·'금리' 단독은 오탐 많아 제외
const KEYWORDS = [
  '부동산', '주택', '아파트', '오피스텔', '빌라', '전세', '월세', '청약', '분양',
  'DSR', 'LTV', '주담대', '주택담보', '디딤돌', '버팀목', '규제지역', '투기과열',
  '조정대상', '재건축', '재개발', '임대', '입주', '전월세',
]

function textOf(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') return String(v.__cdata ?? v['#text'] ?? '')
  return String(v)
}

function toIsoDate(s) {
  // pubDate 다양한 형식 대응: RFC822("Tue, 01 Jul 2026 ...") 또는 "2026-07-01" 또는 "2026.07.01"
  if (!s) return null
  const str = String(s).trim()
  const m = str.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

async function fetchFeed(src) {
  try {
    const res = await fetch(src.url, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 budongsan' },
    })
    if (!res.ok) return []
    const buf = await res.arrayBuffer()
    // 인코딩 대응: 정부 RSS는 대개 UTF-8이지만 EUC-KR인 곳도 있음
    let text = new TextDecoder('utf-8').decode(buf)
    if (/encoding=["']?euc-?kr/i.test(text.slice(0, 200))) {
      try { text = new TextDecoder('euc-kr').decode(buf) } catch {}
    }
    const json = parser.parse(text)
    let items = json?.rss?.channel?.item ?? json?.channel?.item ?? []
    if (!Array.isArray(items)) items = items ? [items] : []
    return items
      .map((it) => ({
        source: src.name,
        title: textOf(it.title).replace(/\s+/g, ' ').trim(),
        link: textOf(it.link).trim(),
        date: toIsoDate(textOf(it.pubDate) || textOf(it.dc_date) || textOf(it['dc:date'])),
        desc: textOf(it.description).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160),
      }))
      .filter((n) => n.title)
  } catch {
    return []
  }
}

function isRealEstate(title) {
  return KEYWORDS.some((k) => title.includes(k))
}

function loadCache() {
  try {
    if (!existsSync(CACHE_FILE)) return null
    const c = JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
    if (Date.now() - c.fetchedAt > TTL_MS) return null
    return c
  } catch {
    return null
  }
}

function saveCache(data) {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(CACHE_FILE, JSON.stringify(data))
  } catch {}
}

export async function fetchLatestNews({ force = false } = {}) {
  if (!force) {
    const cached = loadCache()
    if (cached) return { ...cached, cached: true }
  }

  const all = (await Promise.all(SOURCES.map(fetchFeed))).flat()
  const news = all
    .filter((n) => isRealEstate(n.title))
    .filter((n) => n.date) // 날짜 없는 항목 제외
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30)

  const result = { fetchedAt: Date.now(), count: news.length, news }
  if (news.length > 0) saveCache(result)
  return { ...result, cached: false }
}
