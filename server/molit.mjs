// 국토교통부 아파트 매매 실거래가 API 클라이언트 + XML 파싱.
// 키가 없으면 목업 데이터로 폴백한다.
import { XMLParser } from 'fast-xml-parser'

const API_URL =
  'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade'

const parser = new XMLParser({ ignoreAttributes: false, trimValues: true })

// 표준화된 거래 1건
// { apt, dong, area, priceWon, year, month, day, floor, buildYear, lawdCode }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// MOLIT 실거래가는 apis.data.go.kr 게이트웨이가 간헐적으로 오류/차단을 내므로 재시도한다.
export async function fetchTrades({ lawdCode, dealYmd, serviceKey, rows = 200, retries = 3 }) {
  if (!serviceKey) {
    return { source: 'mock', reason: 'nokey', items: mockTrades(lawdCode, dealYmd) }
  }

  const url = new URL(API_URL)
  url.searchParams.set('serviceKey', serviceKey)
  url.searchParams.set('LAWD_CD', lawdCode)
  url.searchParams.set('DEAL_YMD', dealYmd)
  url.searchParams.set('numOfRows', String(rows))
  url.searchParams.set('pageNo', '1')

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
      // ⚠️ fast-xml-parser는 "000"을 숫자 0으로 변환한다. 그래서 문자열 '00'/'000' 비교는 실패.
      //    성공 판정: <response><header>가 존재하고 resultCode 숫자값이 0.
      //    (인증오류는 <OpenAPI_ServiceResponse> 구조라 response.header가 없음 → header null → 실패로 폴백)
      const header = json?.response?.header
      const ok = header != null && Number(header.resultCode) === 0
      if (ok) {
        let items = json?.response?.body?.items?.item ?? []
        if (!Array.isArray(items)) items = items ? [items] : []
        return { source: 'molit', items: items.map((it) => normalize(it, lawdCode)) }
      }
      // 실패(인증 전파중·일시 차단·throttle 등) → 잠깐 쉬고 재시도
    } catch {
      // 네트워크/타임아웃 → 재시도
    }
    if (attempt < retries - 1) await sleep(500 * (attempt + 1)) // 0.5s, 1s 백오프
  }

  // 모든 재시도 실패 → 목업 폴백(사유 표시)
  return { source: 'mock', reason: 'apierror', items: mockTrades(lawdCode, dealYmd) }
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
