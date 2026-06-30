// 한국부동산원 청약홈 분양정보 API (data.go.kr / odcloud.kr) 클라이언트.
// "한국부동산원_청약홈 분양정보 조회 서비스 - APT 분양정보 상세조회"
//   data.go.kr 데이터 15098547 / 엔드포인트 ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail
//
// 인증키: data.go.kr에서 위 서비스 활용신청(승인) 후 받은 "일반 인증키(Decoding)".
//   .env의 APPLYHOME_SERVICE_KEY, 없으면 MOLIT_SERVICE_KEY 재사용 시도.
//   ※ URLSearchParams가 키를 인코딩하므로 반드시 "Decoding" 키를 넣을 것(Encoding 키는 이중 인코딩됨).
//
// 응답 래퍼: { data:[...], currentCount, matchCount, page, perPage, totalCount }
// 키가 없으면 샘플 일정으로 폴백한다.

const BASE =
  'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail'

const METRO = ['서울', '경기', '인천']

function metroOf(areaName) {
  if (!areaName) return null
  if (areaName.includes('서울')) return '서울'
  if (areaName.includes('경기')) return '경기'
  if (areaName.includes('인천')) return '인천'
  return null
}

function toIso(v) {
  // "20260706" 또는 "2026-07-06" 모두 처리. 유효 8자리만.
  if (!v) return null
  const s = String(v).replace(/[^0-9]/g, '')
  if (s.length !== 8) return null
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

// 분양 공고 1건 → 캘린더 이벤트(특별공급 / 1순위 / 2순위)로 분해
function toEvents(row) {
  const region = row.SUBSCRPT_AREA_CODE_NM || metroOf(row.SUBSCRPT_AREA_CODE_NM) || ''
  const addr = row.HSSPLY_ADRES || ''
  const title = row.HOUSE_NM || '(주택명 미상)'
  const url = row.PBLANC_URL || row.HMPG_ADRES || ''
  const winnerDate = toIso(row.PRZWNER_PRESNATN_DE)
  const moveIn = row.MVN_PREARNGE_YM ? `입주예정 ${row.MVN_PREARNGE_YM}` : undefined
  const supplyCo = row.TOT_SUPLY_HSHLDCO ? `${row.TOT_SUPLY_HSHLDCO}세대` : undefined
  const priceNote = [supplyCo, moveIn].filter(Boolean).join(' · ') || undefined

  const base = { title, region, address: addr, url, winnerDate, priceNote }
  const out = []

  const sp = toIso(row.SPSPLY_RCEPT_BGNDE)
  if (sp) out.push({ ...base, date: sp, type: 'special', households: ['특별공급'] })

  const r1 = toIso(row.GNRL_RNK1_CRSPAREA_RCPTDE || row.GNRL_RNK1_ETC_AREA_RCPTDE)
  if (r1) out.push({ ...base, date: r1, type: 'first', households: [] })

  const r2 = toIso(row.GNRL_RNK2_CRSPAREA_RCPTDE || row.GNRL_RNK2_ETC_AREA_RCPTDE)
  if (r2) out.push({ ...base, date: r2, type: 'second', households: [] })

  return out
}

// odcloud 한 번 호출 → data 배열 반환(오류 시 throw)
async function callOdcloud(serviceKey, { useCond, fromNotice, perPage }) {
  const url = new URL(BASE)
  url.searchParams.set('serviceKey', serviceKey) // Decoding 키 (한 번만 인코딩)
  url.searchParams.set('page', '1')
  url.searchParams.set('perPage', String(perPage))
  if (useCond) url.searchParams.set('cond[RCRIT_PBLANC_DE::GTE]', fromNotice)

  const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`청약홈 API 응답 파싱 실패(HTTP ${res.status}): ${text.slice(0, 160)}`)
  }
  if (!res.ok || !Array.isArray(json?.data)) {
    const msg = json?.msg || json?.message || json?.error || JSON.stringify(json).slice(0, 160)
    throw new Error(`청약홈 API 오류(HTTP ${res.status}): ${msg}`)
  }
  return json
}

export async function fetchSubscriptions({ serviceKey, fromIso, toIsoStr }) {
  if (!serviceKey) {
    return { source: 'mock', items: mockEvents() }
  }

  const fromNotice = shiftIso(fromIso, -45)
  let json
  try {
    // 1차: cond 필터로 최근 공고만 (가벼움)
    json = await callOdcloud(serviceKey, { useCond: true, fromNotice, perPage: 500 })
  } catch (e) {
    // cond 필터가 막히거나(브래킷 인코딩 등) 오류면 → 필터 없이 넉넉히 받아 클라이언트 필터
    json = await callOdcloud(serviceKey, { useCond: false, perPage: 1000 })
  }

  const items = json.data
    .filter((r) => METRO.includes(metroOf(r.SUBSCRPT_AREA_CODE_NM))) // 수도권만
    .flatMap(toEvents)
    .filter((e) => (!fromIso || e.date >= fromIso) && (!toIsoStr || e.date <= toIsoStr)) // 접수일 범위
    .sort((a, b) => a.date.localeCompare(b.date))

  return { source: 'applyhome', items, totalCount: json.totalCount }
}

function shiftIso(iso, days) {
  // iso "YYYY-MM-DD" → days 만큼 이동 (UTC 기준, 단순 계산)
  const [y, m, d] = iso.split('-').map(Number)
  const t = Date.UTC(y, m - 1, d) + days * 86400000
  const nd = new Date(t)
  return `${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, '0')}-${String(nd.getUTCDate()).padStart(2, '0')}`
}

// 샘플 (키 미설정 시)
function mockEvents() {
  return [
    { date: '2026-07-06', title: '래미안 ○○ (샘플)', region: '서울 강동구', type: 'special', households: ['신혼부부', '생애최초', '다자녀'], priceNote: '전용 84㎡ 추정 13억대' },
    { date: '2026-07-07', title: '래미안 ○○ (샘플)', region: '서울 강동구', type: 'first', households: [] },
    { date: '2026-07-13', title: '힐스테이트 △△ (샘플)', region: '경기 하남시', type: 'special', households: ['신혼부부', '신생아', '노부모부양'], priceNote: '전용 74㎡ 추정 8억대' },
    { date: '2026-07-14', title: '힐스테이트 △△ (샘플)', region: '경기 하남시', type: 'first', households: [] },
    { date: '2026-07-20', title: '뉴홈 공공분양 □□ (샘플)', region: '인천 연수구', type: 'special', households: ['신생아', '신혼부부', '다자녀', '생애최초'], priceNote: '나눔형 6억대' },
    { date: '2026-07-21', title: '뉴홈 공공분양 □□ (샘플)', region: '인천 연수구', type: 'first', households: [] },
    { date: '2026-07-27', title: '자이 ◇◇ (샘플)', region: '경기 광명시', type: 'special', households: ['신혼부부', '다자녀'], priceNote: '전용 84㎡ 추정 10억대' },
  ]
}
