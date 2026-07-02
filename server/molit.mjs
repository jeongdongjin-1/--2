// 국토교통부 매매 실거래가 API 클라이언트 + XML 파싱.
// 아파트/오피스텔/연립다세대(빌라) 3종 지원. 키가 없거나 미승인이면 목업 폴백.
// ※ 각 유형은 data.go.kr에서 별도 활용신청 필요(아파트만 신청 시 오피스텔·빌라는 목업).
import { XMLParser } from 'fast-xml-parser'

const API_URLS = {
  apt: 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade',
  offi: 'https://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade',
  villa: 'https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade',
}

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

// 실거래가 조회. type: 'apt'|'offi'|'villa'. totalCount 초과 시 여러 페이지 합산.
export async function fetchTrades({ lawdCode, dealYmd, serviceKey, type = 'apt', rows = 1000, maxItems = 3000 }) {
  const apiUrl = API_URLS[type] || API_URLS.apt
  if (!serviceKey) {
    return { source: 'mock', reason: 'nokey', items: mockTrades(lawdCode, dealYmd, type) }
  }

  const base = new URL(apiUrl)
  base.searchParams.set('serviceKey', serviceKey)
  base.searchParams.set('LAWD_CD', lawdCode)
  base.searchParams.set('DEAL_YMD', dealYmd)
  base.searchParams.set('numOfRows', String(rows))
  const baseStr = base.toString()

  const first = await fetchMolitPage(baseStr, 1)
  if (!first) {
    return { source: 'mock', reason: 'apierror', items: mockTrades(lawdCode, dealYmd, type) }
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
  // 신 API 필드명. 유형별 단지명 필드가 다름(아파트=aptNm, 오피스텔=offiNm, 빌라=mhouseNm).
  const dealAmount = it.dealAmount ?? it['거래금액']
  const aptNm =
    it.aptNm ?? it.offiNm ?? it.mhouseNm ??
    it['아파트'] ?? it['단지'] ?? it['오피스텔'] ?? it['연립다세대']
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
const MOCK_NAMES = {
  apt: ['래미안', '자이', '힐스테이트', '푸르지오', '아이파크', 'e편한세상'],
  offi: ['센트럴타워', '트리마제오피스텔', '스카이시티', '더샵스튜디오', '메트로시티'],
  villa: ['행복빌라', '그린빌', '햇살연립', '누리하임', '해든타운'],
}
// 유형별 가격 수준(억) 배수 — 오피스텔·빌라는 아파트보다 저렴
const MOCK_PRICE_MULT = { apt: 1, offi: 0.55, villa: 0.4 }

function mockTrades(lawdCode, dealYmd, type = 'apt') {
  const seed = Number(lawdCode) + Number(dealYmd)
  const dongs = ['행복동', '한강동', '미래동', '푸른동']
  const names = MOCK_NAMES[type] || MOCK_NAMES.apt
  const mult = MOCK_PRICE_MULT[type] ?? 1
  const out = []
  for (let i = 0; i < 24; i++) {
    const r = (seed * (i + 7)) % 97
    const area = [24, 33, 39, 49, 59, 74, 84][r % 7]
    const base = lawdCode.startsWith('116') ? 18 : lawdCode.startsWith('11') ? 11 : 6 // 84㎡ 기준 억
    // 면적 비례 + 약간의 변동 — 소형 오피스텔·빌라가 비현실적으로 비싸지지 않게
    const priceEok = (base * (area / 84) + (r % 5)) * mult
    out.push({
      apt: type === 'apt' ? `${names[r % names.length]} ${100 + (r % 9)}단지` : `${names[r % names.length]} ${1 + (r % 9)}차`,
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
