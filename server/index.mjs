// API 프록시 + 프로덕션 정적 파일 서빙.
// .env(MOLIT_SERVICE_KEY)를 읽어 실거래가 API를 호출하고, 키가 없으면 목업 폴백.
import express from 'express'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { fetchTrades } from './molit.mjs'
import { fetchSubscriptions, fetchSubscriptionModels } from './applyhome.mjs'
import { geocode } from './geocode.mjs'

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

// 헬스/상태: 키 보유 여부만 노출(키 값은 절대 노출 안 함)
app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    hasKey: Boolean(SERVICE_KEY),
    hasApplyhomeKey: Boolean(APPLYHOME_KEY),
    hasKakaoKey: Boolean(KAKAO_KEY),
    now: new Date().toISOString(),
  })
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

// 실거래가 조회: /api/trades?lawd=11680&ymd=202605
app.get('/api/trades', async (req, res) => {
  const lawdCode = String(req.query.lawd || '')
  const dealYmd = String(req.query.ymd || '')
  if (!/^\d{5}$/.test(lawdCode) || !/^\d{6}$/.test(dealYmd)) {
    return res.status(400).json({ error: 'lawd(5자리), ymd(6자리) 필요' })
  }
  try {
    const { source, items } = await fetchTrades({ lawdCode, dealYmd, serviceKey: SERVICE_KEY })
    res.json({ source, lawdCode, dealYmd, count: items.length, items })
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
