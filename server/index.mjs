// API 프록시 + 프로덕션 정적 파일 서빙.
// .env(MOLIT_SERVICE_KEY)를 읽어 실거래가 API를 호출하고, 키가 없으면 목업 폴백.
import express from 'express'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { fetchTrades } from './molit.mjs'
import { fetchSubscriptions, fetchSubscriptionModels } from './applyhome.mjs'
import { geocode } from './geocode.mjs'
import { computeValuePicks } from './valuePicks.mjs'
import { fetchLatestNews } from './briefings.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// 간단한 .env 로더 (의존성 없이)
function loadEnv() {
  const p = join(root, '.env')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}
loadEnv()

const SERVICE_KEY = process.env.MOLIT_SERVICE_KEY || ''
const APPLYHOME_KEY = process.env.APPLYHOME_SERVICE_KEY || SERVICE_KEY
const KAKAO_KEY = process.env.KAKAO_REST_KEY || ''
const PORT = Number(process.env.PORT || 4000)

function isoDaysFromNow(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const app = express()
app.set('trust proxy', 1) // Render 등 프록시 뒤에서 실제 클라이언트 IP 인식

// ── 간단 rate limit: IP당 분당 120요청 (공개 URL로 data.go.kr/카카오 쿼터 소진 방지) ──
const rlBuckets = new Map() // ip → { count, resetAt }
setInterval(() => {
  const now = Date.now()
  for (const [ip, b] of rlBuckets) if (b.resetAt < now) rlBuckets.delete(ip)
}, 5 * 60 * 1000).unref?.()

app.use('/api', (req, res, next) => {
  const ip = req.ip || 'unknown'
  const now = Date.now()
  let b = rlBuckets.get(ip)
  if (!b || b.resetAt < now) {
    b = { count: 0, resetAt: now + 60_000 }
    rlBuckets.set(ip, b)
  }
  if (++b.count > 120) {
    return res.status(429).json({ error: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.' })
  }
  next()
})

// 키 지문: 값 자체는 노출하지 않고 길이/앞4/뒤4자리만(오입력·공백 진단용)
function fp(k) {
  if (!k) return null
  const t = k // 원본 그대로(공백 포함 여부 확인 위해 trim 안 함)
  return { len: t.length, head: t.slice(0, 4), tail: t.slice(-4), trimmedLen: t.trim().length }
}

// 헬스/상태: 키 보유 여부 + 지문(값은 노출 안 함)
app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(SERVICE_KEY),
    hasApplyhomeKey: Boolean(APPLYHOME_KEY),
    hasKakaoKey: Boolean(KAKAO_KEY),
    keyFp: {
      molit: fp(SERVICE_KEY),
      applyhome: fp(APPLYHOME_KEY),
      kakao: fp(KAKAO_KEY),
    },
    now: new Date().toISOString(),
  })
})

// 정책 최신 소식(자동 수집): /api/briefings[?force=1] — 부처 RSS, 6시간 캐시
// '청약' 카테고리는 보도자료가 뜸한 시기가 있어 청약홈 실제 분양공고(특별공급 접수 임박순)를 병합한다.
app.get('/api/briefings', async (req, res) => {
  try {
    const data = await fetchLatestNews({ force: req.query.force === '1' })
    let news = data.news

    try {
      const subs = await fetchSubscriptions({
        serviceKey: APPLYHOME_KEY,
        fromIso: isoDaysFromNow(0),
        toIsoStr: isoDaysFromNow(45),
      })
      if (subs.source === 'applyhome') {
        const seen = new Set()
        const subNews = subs.items
          .filter((e) => e.type === 'special') // 공고당 1건(특별공급 접수일 기준)
          .filter((e) => (seen.has(e.title) ? false : (seen.add(e.title), true)))
          .slice(0, 6)
          .map((e) => ({
            source: '청약홈',
            category: '청약',
            title: `[청약접수 ${e.date.slice(5).replace('-', '.')}] ${e.title} — ${e.region}`,
            link: e.url || 'https://www.applyhome.co.kr',
            date: e.date,
            desc: e.priceNote || '',
          }))
        news = [...subNews, ...news].sort((a, b) => b.date.localeCompare(a.date))
      }
    } catch {} // 청약홈 실패 시 보도자료만

    res.json({ ...data, count: news.length, news })
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e), news: [] })
  }
})

// 지오코딩: /api/geocode?q=강남구 래미안
app.get('/api/geocode', async (req, res) => {
  const q = String(req.query.q || '')
  try {
    const result = await geocode(q, KAKAO_KEY)
    res.json({ query: q, result, hasKey: Boolean(KAKAO_KEY) })
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) })
  }
})

// 청약 일정: /api/subscriptions?from=2026-06-01&to=2026-09-30
app.get('/api/subscriptions', async (req, res) => {
  const fromIso = String(req.query.from || isoDaysFromNow(-30))
  const toIsoStr = String(req.query.to || isoDaysFromNow(90))
  try {
    const { source, items } = await fetchSubscriptions({
      serviceKey: APPLYHOME_KEY,
      fromIso,
      toIsoStr,
    })
    res.json({ source, from: fromIso, to: toIsoStr, count: items.length, items })
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) })
  }
})

// 군 관련 청약 일정: /api/military-subscriptions
// 다가오는 특별공급 중 '기관추천' 물량(장기복무 군인·국가유공자 등 대상)이 있는 단지만 추림. 6시간 캐시.
let milSubsCache = null // { at, payload }
app.get('/api/military-subscriptions', async (_req, res) => {
  if (milSubsCache && Date.now() - milSubsCache.at < 6 * 60 * 60 * 1000) {
    return res.json({ ...milSubsCache.payload, cached: true })
  }
  try {
    const subs = await fetchSubscriptions({
      serviceKey: APPLYHOME_KEY,
      fromIso: isoDaysFromNow(-7), // 접수 직전·진행 중 포함
      toIsoStr: isoDaysFromNow(60),
    })
    if (subs.source !== 'applyhome') return res.json({ source: subs.source, items: [] })

    // 특별공급 이벤트를 공고(hmNo) 단위로 유니크하게, 접수일 순 최대 12개
    const seen = new Set()
    const candidates = subs.items
      .filter((e) => e.type === 'special' && e.hmNo)
      .filter((e) => (seen.has(e.hmNo) ? false : (seen.add(e.hmNo), true)))
      .slice(0, 12)

    // 공고별 주택형 조회(동시 4개)로 기관추천 세대수 확인
    const out = []
    let idx = 0
    async function worker() {
      while (idx < candidates.length) {
        const e = candidates[idx++]
        try {
          const m = await fetchSubscriptionModels({ serviceKey: APPLYHOME_KEY, hmNo: e.hmNo })
          const cnt = m.specialCounts?.['기관추천'] || 0
          if (cnt > 0) out.push({ ...e, insttCount: cnt })
        } catch {}
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker))
    out.sort((a, b) => a.date.localeCompare(b.date))

    const payload = { source: 'applyhome', count: out.length, items: out }
    milSubsCache = { at: Date.now(), payload }
    res.json(payload)
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e), items: [] })
  }
})

// 평형별 분양가 + 특별공급 유형: /api/subscription-models?hmNo=2026000219
app.get('/api/subscription-models', async (req, res) => {
  const hmNo = String(req.query.hmNo || '')
  if (!hmNo) return res.status(400).json({ error: 'hmNo 필요' })
  try {
    const data = await fetchSubscriptionModels({ serviceKey: APPLYHOME_KEY, hmNo })
    res.json({ hmNo, ...data })
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) })
  }
})

// 실거래가 조회: /api/trades?lawd=11680&ymd=202605&type=apt|offi|villa
// 실데이터는 1시간 메모리 캐시(일 24회 갱신 = 일일 최신 유지 + data.go.kr 호출 절약).
// 목업(미승인·오류)은 캐시하지 않아 승인·복구 시 즉시 실데이터로 전환된다.
const tradesCache = new Map() // key → { at, payload }
const TRADES_TTL = 60 * 60 * 1000

// 캐시를 통과하는 실거래 조회(핸들러·이력 엔드포인트 공용)
async function getTradesCached(type, lawdCode, dealYmd) {
  const key = `${type}|${lawdCode}|${dealYmd}`
  const hit = tradesCache.get(key)
  if (hit && Date.now() - hit.at < TRADES_TTL) return { ...hit.payload, cached: true }
  const { source, reason, items } = await fetchTrades({ lawdCode, dealYmd, type, serviceKey: SERVICE_KEY })
  const payload = { source, reason, type, lawdCode, dealYmd, count: items.length, items }
  if (source === 'molit') tradesCache.set(key, { at: Date.now(), payload })
  return payload
}

app.get('/api/trades', async (req, res) => {
  const lawdCode = String(req.query.lawd || '')
  const dealYmd = String(req.query.ymd || '')
  const type = ['apt', 'offi', 'villa'].includes(String(req.query.type)) ? String(req.query.type) : 'apt'
  if (!/^\d{5}$/.test(lawdCode) || !/^\d{6}$/.test(dealYmd)) {
    return res.status(400).json({ error: 'lawd(5자리), ymd(6자리) 필요' })
  }
  try {
    res.json(await getTradesCached(type, lawdCode, dealYmd))
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) })
  }
})

// AI 가성비 분석: /api/value-picks?lawd=11680&type=apt
// 최근 4개월 중 데이터 있는 달(최대 3개월)을 합산해 단지별 가성비 스코어 산출. 월 데이터는 1h 캐시 공유.
app.get('/api/value-picks', async (req, res) => {
  const lawdCode = String(req.query.lawd || '')
  const type = ['apt', 'offi', 'villa'].includes(String(req.query.type)) ? String(req.query.type) : 'apt'
  const top = Math.min(Math.max(Number(req.query.top) || 20, 5), 60)
  if (!/^\d{5}$/.test(lawdCode)) return res.status(400).json({ error: 'lawd(5자리) 필요' })

  try {
    const now = new Date()
    const monthsData = []
    let source = 'mock'
    for (let i = 0; i < 4 && monthsData.length < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
      const r = await getTradesCached(type, lawdCode, ymd)
      if (r.source === 'molit') source = 'molit'
      if (r.items.length > 0) monthsData.push({ ymd, items: r.items })
    }
    // 과거→최신 순으로 정렬(추세 계산용)
    monthsData.sort((a, b) => a.ymd.localeCompare(b.ymd))
    const picks = computeValuePicks(monthsData, { top })
    res.json({
      source, type, lawdCode,
      monthsUsed: monthsData.map((m) => m.ymd),
      count: picks.length,
      picks,
    })
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) })
  }
})

// 단지 시세 이력: /api/complex-history?lawd=11680&apt=한양3&type=apt&area=161.9&months=12
// 해당 단지(±1㎡ 평형)의 월별 거래를 모아 추이를 반환. 월 데이터는 위 1시간 캐시를 공유.
app.get('/api/complex-history', async (req, res) => {
  const lawdCode = String(req.query.lawd || '')
  const apt = String(req.query.apt || '').trim()
  const type = ['apt', 'offi', 'villa'].includes(String(req.query.type)) ? String(req.query.type) : 'apt'
  const area = req.query.area != null && req.query.area !== '' ? Number(req.query.area) : null
  const months = Math.min(Math.max(Number(req.query.months) || 12, 1), 15)
  if (!/^\d{5}$/.test(lawdCode) || !apt) {
    return res.status(400).json({ error: 'lawd(5자리), apt 필요' })
  }

  const now = new Date()
  const ymds = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  try {
    // 동시 3개로 월별 조회(대부분 캐시 히트)
    const results = new Array(ymds.length)
    let idx = 0
    async function worker() {
      while (idx < ymds.length) {
        const i = idx++
        try {
          results[i] = await getTradesCached(type, lawdCode, ymds[i])
        } catch {
          results[i] = null
        }
      }
    }
    await Promise.all(Array.from({ length: 3 }, worker))

    let source = 'mock'
    const monthsOut = ymds.map((ymd, i) => {
      const r = results[i]
      if (r?.source === 'molit') source = 'molit'
      const deals = (r?.items || [])
        .filter((t) => t.apt === apt && (area == null || Math.abs(t.area - area) <= 1))
        .map((t) => ({ y: t.year, m: t.month, d: t.day, area: t.area, floor: t.floor, priceWon: t.priceWon }))
        .sort((a, b) => b.m * 100 + b.d - (a.m * 100 + a.d))
      const prices = deals.map((x) => x.priceWon).sort((a, b) => a - b)
      const mid = prices.length
        ? prices.length % 2
          ? prices[(prices.length - 1) / 2]
          : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
        : 0
      return { ymd, count: deals.length, medianWon: Math.round(mid), deals: deals.slice(0, 10) }
    })

    res.json({ source, apt, area, lawdCode, type, months: monthsOut.reverse() }) // 과거→최신 순
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) })
  }
})

// 프로덕션: 빌드 결과 서빙
const distDir = join(root, 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (_req, res) => res.sendFile(join(distDir, 'index.html')))
}

app.listen(PORT, () => {
  console.log(`[api] http://localhost:${PORT}  (실거래가 키: ${SERVICE_KEY ? '있음' : '없음 → 목업'})`)
})
