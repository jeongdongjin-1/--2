// 국토교통부 아파트 매매 실거래가 API 클라이언트 + XML 파싱.
// 키가 없으면 목업 데이터로 폴백한다.
import { XMLParser } from 'fast-xml-parser'

const API_URL =
  'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade'

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true })

// 표준화된 거래 1건
// { apt, dong, area, priceWon, year, month, day, floor, buildYear, lawdCode }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 한 페이지 조회(재시도 포함). 성공 시 { items(raw[]), totalCount }, 실패 시 null.
async function fetchMolitPage(baseUrl, pageNo, retries = 3) {
  const url = new URL(baseUrl)
  url.searchParams.set('pageNo', String(pageNo))
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // data.go.kr 게이트웨이는 User-Agent 없는 요청을 차단(400)하므로 반드시 설정
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 budongsan' },
      })
      const text = await res.text()
      let json = null
      try {
        json = parser.parse(text)
      } catch {}
      // ⚠️ fast-xml-parser는 "000"을 숫자 0으로 변환 → 문자열 비교 대신 (header 존재 && Number(resultCode)===0).
      const header = json?.response?.header
      if (header != null && Number(header.resultCode) === 0) {
        let items = json?.response?.body?.items?.item ?? []
        if (!Array.isArray(items)) items = items ? [items] : []
        const totalCount = Number(json?.response?.body?.totalCount) || items.length
        return { items, totalCount }
      }
      // 실패(인증 전파중·일시 차단·throttle 등) → 재시도
    } catch {
      // 네트워크/타임아웃 → 재시도
    }
    if (attempt < retries - 1) await sleep(500 * (attempt + 1))
  }
  return null
}

// 실거래가 조회. totalCount가 rows보다 크면 여러 페이지를 합산한다(200건 초과 달 누락 방지).
export async function fetchTrades({ lawdCode, dealYmd, serviceKey, rows = 1000, maxItems = 3000 }) {
  if (!serviceKey) {
    return { source: 'mock', reason: 'nokey', items: mockTrades(lawdCode, dealYmd) }
  }

  const base = new URL(API_URL)
  base.searchParams.set('serviceKey', serviceKey)
  base.searchParams.set('LAWD_CD', lawdCode)
  base.searchParams.set('DEAL_YMD', dealYmd)
  base.searchParams.set('numOfRows', String(rows))
  const baseStr = base.toString()

  const first = await fetchMolitPage(baseStr, 1)
  if (!first) {
    return { source: 'mock', reason: 'apierror', items: mockTrades(lawdCode, dealYmd) }
  }

  let raw = first.items
  const pagesNeeded = Math.min(Math.ceil(first.totalCount / rows), Math.ceil(maxItems / rows))
  if (pagesNeeded > 1) {
    const extra = await Promise.all(
      Array.from({ length: pagesNeeded - 1 }, (_, i) => fetchMolitPage(baseStr, i + 2))
    )
    for (const p of extra) if (p) raw = raw.concat(p.items)
  }

  return { source: 'molit', items: raw.map((it) => normalize(it, lawdCode)) }
}

function num(v) {
  if (v == null) return 0
  return Number(String(v).replace(/[, ]/g, '')) || 0
}

function normalize(it, lawdCode) {
  // 신 API 필드명. 일부 응답은 한글 필드일 수 있어 양쪽 모두 대응.
  const dealAmount = it.dealAmount ?? it['거래금액']
  const aptNm = it.aptNm ?? it['아파트']
  const area = it.excluUseAr ?? it['전용면적']
  const year = it.dealYear ?? it['년']
  const month = it.dealMonth ?? it['월']
  const day = it.dealDay ?? it['일']
  const floor = it.floor ?? it['층']
  const buildYear = it.buildYear ?? it['건축년도']
  const dong = it.umdNm ?? it['법정동']
  const jibun = it.jibun ?? it['지번']

  return {
    apt: String(aptNm ?? '').trim(),
    dong: String(dong ?? '').trim(),
    jibun: String(jibun ?? '').trim(),
    area: num(area), // 전용면적 m²
    priceWon: num(dealAmount) * 10_000, // 만원 → 원
    year: num(year),
    month: num(month),
    day: num(day),
    floor: num(floor),
    buildYear: num(buildYear),
    lawdCode,
  }
}

// ── 목업: 키 발급 전 UI/기능 확인용 (실제 단지명과 무관한 가짜 데이터) ──
function mockTrades(lawdCode, dealYmd) {
  const seed = Number(lawdCode) + Number(dealYmd)
  const dongs = ['행복동', '한강동', '미래동', '푸른동']
  const names = ['래미안', '자이', '힐스테이트', '푸르지오', '아이파크', 'e편한세상']
  const out = []
  for (let i = 0; i < 24; i++) {
    const r = (seed * (i + 7)) % 97
    const area = [39, 49, 59, 74, 84, 101, 114][r % 7]
    const base = lawdCode.startsWith('116') ? 18 : lawdCode.startsWith('11') ? 11 : 6 // 억 기준 대략
    const priceEok = base + (r % 9) + area / 60
    out.push({
      apt: `${names[r % names.length]} ${100 + (r % 9)}단지`,
      dong: dongs[r % dongs.length],
      area,
      priceWon: Math.round(priceEok * 100_000_000),
      year: Number(dealYmd.slice(0, 4)),
      month: Number(dealYmd.slice(4, 6)),
      day: 1 + (r % 27),
      floor: 1 + (r % 25),
      buildYear: 1998 + (r % 26),
      lawdCode,
    })
  }
  return out
}
