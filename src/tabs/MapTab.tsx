import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { REGIONS, REGION_COORDS, SIDO_LIST, type Region } from '../data/regions'
import { CURRENT_POLICY } from '../data/policy'
import { computeAffordability, formatWon, isRegulated } from '../lib/affordability'
import { loadProfile } from '../lib/profileStore'

type Trade = { apt: string; dong: string; area: number; priceWon: number; buildYear: number }

type RegionStat = {
  code: string; name: string; pos: [number, number]
  total: number; affordable: number; median: number
}

type AptMarker = {
  apt: string; pos: [number, number]; precise: boolean
  priceWon: number; affordable: boolean; count: number
  areaText: string; dong: string; place?: string
}

const SIDO_VIEW: Record<Region['sido'], { center: [number, number]; zoom: number }> = {
  서울: { center: [37.5665, 126.978], zoom: 11 },
  경기: { center: [37.41, 127.05], zoom: 9 },
  인천: { center: [37.46, 126.7], zoom: 11 },
}

function recentYmd(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// 단지명 해시로 구 중심 주변에 결정적 분산 배치 (지오코딩 실패/키없음 시)
function jitter(center: [number, number], name: string): [number, number] {
  let h = 2166136261
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h = h >>> 0
  const ang = ((h % 360) * Math.PI) / 180
  const rad = 0.0025 + (((h >>> 9) % 100) / 100) * 0.011
  return [center[0] + Math.sin(ang) * rad, center[1] + Math.cos(ang) * rad]
}

function ViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [center[0], center[1], zoom, map])
  return null
}

export default function MapTab() {
  const [sido, setSido] = useState<Region['sido']>('서울')
  const [gu, setGu] = useState<string>('11680') // 'all' 또는 LAWD 코드
  const [ymd, setYmd] = useState(recentYmd())
  const [stats, setStats] = useState<RegionStat[]>([])
  const [apts, setApts] = useState<AptMarker[]>([])
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState('')
  const [hasKakao, setHasKakao] = useState(false)

  const profile = useMemo(() => loadProfile(), [])
  const guRegions = useMemo(
    () => REGIONS.filter((r) => r.sido === sido && REGION_COORDS[r.code]),
    [sido]
  )

  const view = useMemo(() => {
    if (gu !== 'all' && REGION_COORDS[gu]) return { center: REGION_COORDS[gu], zoom: 14 }
    return SIDO_VIEW[sido]
  }, [gu, sido])

  // 구별 요약 모드
  async function loadAggregate() {
    setLoading(true)
    let src = ''
    const out: RegionStat[] = []
    await Promise.all(
      guRegions.map(async (r) => {
        try {
          const res = await fetch(`/api/trades?lawd=${r.code}&ymd=${ymd}`)
          const json = await res.json()
          src = json.source || src
          const prices: number[] = (json.items || []).map((t: Trade) => t.priceWon)
          const afford = computeAffordability(profile, CURRENT_POLICY, isRegulated(r.code, CURRENT_POLICY))
          out.push({
            code: r.code, name: r.name, pos: REGION_COORDS[r.code],
            total: prices.length, median: median(prices),
            affordable: prices.filter((p) => p <= afford.maxPriceWon).length,
          })
        } catch {}
      })
    )
    setStats(out)
    setSource(src)
    setLoading(false)
  }

  // 개별 단지 모드
  async function loadApts(code: string) {
    setLoading(true)
    const center = REGION_COORDS[code]
    const regionName = REGIONS.find((r) => r.code === code)?.name ?? ''
    const afford = computeAffordability(profile, CURRENT_POLICY, isRegulated(code, CURRENT_POLICY))
    try {
      const res = await fetch(`/api/trades?lawd=${code}&ymd=${ymd}`)
      const json = await res.json()
      setSource(json.source || '')
      const trades: Trade[] = json.items || []

      // 단지명 기준 그룹화
      const byApt = new Map<string, Trade[]>()
      for (const t of trades) {
        if (!byApt.has(t.apt)) byApt.set(t.apt, [])
        byApt.get(t.apt)!.push(t)
      }

      const markers = await Promise.all(
        [...byApt.entries()].map(async ([apt, list]) => {
          const prices = list.map((t) => t.priceWon)
          const areas = list.map((t) => t.area)
          const med = median(prices)
          const dong = list[0].dong
          // 지오코딩 시도 ("구 단지명"), 실패 시 구 중심 주변 분산
          let pos = jitter(center, apt)
          let precise = false
          let place: string | undefined
          try {
            const g = await fetch(`/api/geocode?q=${encodeURIComponent(`${regionName} ${apt}`)}`)
            const gj = await g.json()
            if (gj.result && gj.result.precise) {
              pos = [gj.result.lat, gj.result.lng]
              precise = true
              place = gj.result.place
            }
          } catch {}
          const areaText =
            areas.length > 1
              ? `${Math.min(...areas)}~${Math.max(...areas)}㎡`
              : `${areas[0]}㎡`
          return {
            apt, pos, precise, place, dong,
            priceWon: med, count: list.length,
            affordable: med <= afford.maxPriceWon,
            areaText,
          } as AptMarker
        })
      )
      setApts(markers)
    } catch {
      setApts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then((s) => setHasKakao(Boolean(s.hasKakaoKey))).catch(() => {})
  }, [])

  useEffect(() => {
    if (gu === 'all') { setApts([]); loadAggregate() }
    else { setStats([]); loadApts(gu) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sido, gu, ymd])

  const budget = useMemo(
    () => computeAffordability(profile, CURRENT_POLICY, false).maxPriceWon,
    [profile]
  )

  const preciseCount = apts.filter((a) => a.precise).length

  return (
    <div className="map-tab">
      <div className="map-controls">
        <select value={sido} onChange={(e) => {
          const s = e.target.value as Region['sido']
          setSido(s)
          setGu('all')
        }}>
          {SIDO_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={gu} onChange={(e) => setGu(e.target.value)}>
          <option value="all">전체 (구별 요약)</option>
          {guRegions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
        </select>
        <input className="ymd" value={ymd} maxLength={6}
          onChange={(e) => setYmd(e.target.value.replace(/\D/g, ''))} placeholder="YYYYMM" />
        <span className="map-budget">내 예산(비규제) <b>{formatWon(budget)}</b></span>
        <span className="map-legend">
          <i className="dot green" /> 입주 가능
          <i className="dot red" /> 예산 초과
          {gu === 'all' && <><i className="dot gray" /> 거래 없음</>}
        </span>
        {loading && <span className="map-loading">불러오는 중…</span>}
        <span className="source">
          {source === 'mock' ? '⚠️ 목업' : source === 'molit' ? '✅ 실거래가' : ''}
        </span>
      </div>

      {gu !== 'all' && (
        <div className="map-subbar">
          {apts.length > 0
            ? <>단지 <b>{apts.length}</b>곳 · 입주 가능 <b className="ok">{apts.filter(a => a.affordable).length}</b>곳
                {hasKakao
                  ? <> · 위치 정확 {preciseCount}/{apts.length}</>
                  : <> · <span className="warn-text">📍 위치는 근사값 (카카오 키 설정 시 정확 위치)</span></>}
              </>
            : !loading && <>이 지역·월 거래가 없습니다.</>}
        </div>
      )}

      <div className="map-wrap">
        <MapContainer center={view.center} zoom={view.zoom} style={{ height: '100%', width: '100%' }}>
          <ViewController center={view.center} zoom={view.zoom} />
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* 구별 요약 모드 */}
          {gu === 'all' && stats.map((s) => {
            const color = s.total === 0 ? '#9ca3af' : s.affordable > 0 ? '#16a34a' : '#ef4444'
            const radius = s.total === 0 ? 8 : Math.min(26, 9 + s.total)
            return (
              <CircleMarker key={s.code} center={s.pos} radius={radius}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 2 }}
                eventHandlers={{ click: () => setGu(s.code) }}>
                <Tooltip direction="top" opacity={1}>
                  <b>{s.name}</b>{s.affordable > 0 ? ` · 가능 ${s.affordable}건` : ''} · 클릭하면 단지 보기
                </Tooltip>
                <Popup>
                  <div className="map-pop">
                    <b>{s.name}</b>
                    <div>중위 실거래 {s.median ? formatWon(s.median) : '-'}</div>
                    <div>거래 {s.total}건 중 <b style={{ color: '#16a34a' }}>{s.affordable}건</b> 입주 가능</div>
                    {isRegulated(s.code, CURRENT_POLICY) && <div className="reg">규제지역</div>}
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}

          {/* 개별 단지 모드 */}
          {gu !== 'all' && apts.map((a, i) => {
            const color = a.affordable ? '#16a34a' : '#ef4444'
            return (
              <CircleMarker key={a.apt + i} center={a.pos} radius={9}
                pathOptions={{ color, fillColor: color, fillOpacity: a.precise ? 0.85 : 0.5, weight: 2 }}>
                <Tooltip direction="top" opacity={1}>
                  <b>{a.apt.replace(/\s*\d+단지/, m => m)}</b> · {formatWon(a.priceWon)}
                </Tooltip>
                <Popup>
                  <div className="map-pop">
                    <b>{a.apt}</b>
                    <div>{a.dong} · 전용 {a.areaText} · 거래 {a.count}건</div>
                    <div>중위가 <b>{formatWon(a.priceWon)}</b></div>
                    <div className={a.affordable ? 'aff-ok' : 'aff-no'}>
                      {a.affordable ? '✓ 입주 가능' : `✗ ${formatWon(a.priceWon - budget)} 초과`}
                    </div>
                    {a.place && <div className="reg" style={{ color: '#2563eb' }}>📍 {a.place}</div>}
                    {!a.precise && <div className="reg">📍 근사 위치</div>}
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
