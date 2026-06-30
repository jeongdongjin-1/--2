// 한국부동산원 청약홈 분양정보 API (data.go.kr / odcloud.kr) 클라이언트.
// "한국부동산원_청약홈 분양정보 조회 서비스 - APT 분양정보 상세조회".
// 키가 없으면 샘플 일정으로 폴백한다.
//
// 키: data.go.kr에서 위 서비스 활용신청 후 받은 인증키. .env의
//     APPLYHOME_SERVICE_KEY, 없으면 MOLIT_SERVICE_KEY 재사용 시도.

const BASE =
  'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail'

// 수도권만 필터
const METRO = ['서울', '경기', '인천']

function metroOf(areaName) {
  if (!areaName) return null
  if (areaName.includes('서울')) return '서울'
  if (areaName.includes('경기')) return '경기'
  if (areaName.includes('인천')) return '인천'
  return null
}

function toIso(yyyymmdd) {
  // "20260706" 또는 "2026-07-06" 모두 처리
  if (!yyyymmdd) return null
  const s = String(yyyymmdd).replace(/[^0-9]/g, '')
  if (s.length !== 8) return null
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

// 분양 1건 → 캘린더 이벤트 0~3개로 분해
function toEvents(row) {
  const region = `${metroOf(row.SUBSCRPT_AREA_CODE_NM) ?? ''} ${row.HSSPLY_ADRES ?? ''}`.trim()
  const title = row.HOUSE_NM ?? '(주택명 미상)'
  const out = []

  const sp = toIso(row.SPSPLY_RCEPT_BGNDE)
  if (sp) out.push({ date: sp, title, region: row.SUBSCRPT_AREA_CODE_NM ?? region, type: 'special', households: ['특별공급'], priceNote: row.MVN_PREARNGE_YM ? `입주예정 ${row.MVN_PREARNGE_YM}` : undefined })

  const r1 = toIso(row.GNRL_RNK1_CRSPAREA_RCPTDE || row.GNRL_RNK1_ETC_AREA_RCPTDE)
  if (r1) out.push({ date: r1, title, region: row.SUBSCRPT_AREA_CODE_NM ?? region, type: 'first', households: [] })

  const r2 = toIso(row.GNRL_RNK2_CRSPAREA_RCPTDE || row.GNRL_RNK2_ETC_AREA_RCPTDE)
  if (r2) out.push({ date: r2, title, region: row.SUBSCRPT_AREA_CODE_NM ?? region, type: 'second', households: [] })

  return out
}

export async function fetchSubscriptions({ serviceKey, fromIso, toIsoStr }) {
  if (!serviceKey) {
    return { source: 'mock', items: mockEvents() }
  }

  const url = new URL(BASE)
  url.searchParams.set('serviceKey', serviceKey)
  url.searchParams.set('page', '1')
  url.searchParams.set('perPage', '200')
  // 모집공고일 기준 최근 것 위주로. cond는 odcloud 필터 문법.
  url.searchParams.set('cond[RCRIT_PBLANC_DE::GTE]', fromIso)

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`청약홈 API HTTP ${res.status}`)
  const json = await res.json()
  const rows = Array.isArray(json?.data) ? json.data : []

  const items = rows
    .filter((r) => (r.HOUSE_SECD_NM ?? r.HOUSE_DTL_SECD_NM ?? 'APT').includes('APT') || metroOf(r.SUBSCRPT_AREA_CODE_NM))
    .filter((r) => METRO.includes(metroOf(r.SUBSCRPT_AREA_CODE_NM)))
    .flatMap(toEvents)
    .filter((e) => (!fromIso || e.date >= fromIso) && (!toIsoStr || e.date <= toIsoStr))
    .sort((a, b) => a.date.localeCompare(b.date))

  return { source: 'applyhome', items }
}

// 샘플 (키 미설정 시) — CalendarTab의 정적 데이터와 동일한 형태
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
