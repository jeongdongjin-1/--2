// API 프록시 + 프로덕션 정적 파일 서빙.
// .env(MOLIT_SERVICE_KEY)를 읽어 실거래가 API를 호출하고, 키가 없으면 목업 폴백.
import express from 'express'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { fetchTrades } from './molit.mjs'

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
const PORT = Number(process.env.PORT || 4000)

const app = express()

// 헬스/상태: 키 보유 여부만 노출(키 값은 절대 노출 안 함)
app.get('/api/status', (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(SERVICE_KEY), now: new Date().toISOString() })
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
