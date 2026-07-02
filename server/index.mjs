// API 프록시 + 프로덕션 정적 파일 서빙.
// .env(MOLIT_SERVICE_KEY)를 읽어 실거래가 API를 호출하고, 키가 없으면 목업 폴백.
import express from 'express'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { fetchTrades } from './molit.mjs'
import { fetchSubscriptions, fetchSubscriptionModels } from './applyhome.mjs'
import { geocode } from './geocode.mjs'
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

app.get('/api/trades', async (req, res) => {
  const lawdCode = String(req.query.lawd || '')
  const dealYmd = String(req.query.ymd || '')
  const type = ['apt', 'offi', 'villa'].includes(String(req.query.type)) ? String(req.query.type) : 'apt'
  if (!/^\d{5}$/.test(lawdCode) || !/^\d{6}$/.test(dealYmd)) {
    return res.status(400).json({ error: 'lawd(5자리), ymd(6자리) 필요' })
  }

  const key = `${type}|${lawdCode}|${dealYmd}`
  const hit = tradesCache.get(key)
  if (hit && Date.now() - hit.at < TRADES_TTL) {
    return res.json({ ...hit.payload, cached: true })
  }

  try {
    const { source, reason, items } = await fetchTrades({ lawdCode, dealYmd, type, serviceKey: SERVICE_KEY })
    const payload = { source, reason, type, lawdCode, dealYmd, count: items.length, items }
    if (source === 'molit') tradesCache.set(key, { at: Date.now(), payload })
    res.json(payload)
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
