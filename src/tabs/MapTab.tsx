import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { REGIONS, REGION_COORDS, SIDO_LIST, type Region } from '../data/regions'
import { CURRENT_POLICY } from '../data/policy'
import { computeAffordability, formatWon, isRegulated } from '../lib/affordability'
import { loadProfile } from '../lib/profileStore'

type RegionStat = {
  code: string
  name: string
  pos: [number, number]
  total: number
  affordable: number
  median: number
  loading: boolean
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

// 시도 변경 시 지도 뷰 이동
function ViewController({ sido }: { sido: Region['sido'] }) {
  const map = useMap()
  useEffect(() => {
    const v = SIDO_VIEW[sido]
    map.setView(v.center, v.zoom)
  }, [sido, map])
  return null
}

export default function MapTab() {
  const [sido, setSido] = useState<Region['sido']>('서울')
  const [ymd, setYmd] = useState(recentYmd())
  const [stats, setStats] = useState<Record<string, RegionStat>>({})
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState('')

  const profile = useMemo(() => loadProfile(), [])
  const regions = useMemo(() => REGIONS.filter((r) => r.sido === sido && REGION_COORDS[r.code]), [sido])

  async function loadAll() {
    setLoading(true)
    const next: Record<string, RegionStat> = {}
    for (const r of regions) {
      next[r.code] = {
        code: r.code, name: r.name, pos: REGION_COORDS[r.code],
        total: 0, affordable: 0, median: 0, loading: true,
      }
    }
    setStats(next)

    let src = ''
    await Promise.all(
      regions.map(async (r) => {
        try {
          const res = await fetch(`/api/trades?lawd=${r.code}&ymd=${ymd}`)
          const json = await res.json()
          src = json.source || src
          const prices: number[] = (json.items || []).map((t: any) => t.priceWon)
          const regulated = isRegulated(r.code, CURRENT_POLICY)
          const afford = computeAffordability(profile, CURRENT_POLICY, regulated)
          const affordable = prices.filter((p) => p <= afford.maxPriceWon).length
          next[r.code] = {
            code: r.code, name: r.name, pos: REGION_COORDS[r.code],
            total: prices.length, affordable, median: median(prices), loading: false,
          }
        } catch {
          next[r.code] = { ...next[r.code], loading: false }
        }
      })
    )
    setStats({ ...next })
    setSource(src)
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sido, ymd])

  const budget = useMemo(() => {
    // 비규제 기준 대표 예산(헤더 표시용)
    const a = computeAffordability(profile, CURRENT_POLICY, false)
    return a.maxPriceWon
  }, [profile])

  return (
    <div className="map-tab">
      <div className="map-controls">
        <select value={sido} onChange={(e) => setSido(e.target.value as Region['sido'])}>
          {SIDO_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="ymd" value={ymd} maxLength={6}
          onChange={(e) => setYmd(e.target.value.replace(/\D/g, ''))} placeholder="YYYYMM" />
        <span className="map-budget">내 예산(비규제) <b>{formatWon(budget)}</b></span>
        <span className="map-legend">
          <i className="dot green" /> 입주 가능 매물 있음
          <i className="dot red" /> 예산 초과만
          <i className="dot gray" /> 거래 없음
        </span>
        {loading && <span className="map-loading">불러오는 중…</span>}
        <span className="source">
          {source === 'mock' ? '⚠️ 목업' : source === 'molit' ? '✅ 실거래가' : ''}
        </span>
      </div>

      <div className="map-wrap">
        <MapContainer center={SIDO_VIEW[sido].center} zoom={SIDO_VIEW[sido].zoom} style={{ height: '100%', width: '100%' }}>
          <ViewController sido={sido} />
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {Object.values(stats).map((s) => {
            const color = s.total === 0 ? '#9ca3af' : s.affordable > 0 ? '#16a34a' : '#ef4444'
            const radius = s.total === 0 ? 8 : Math.min(26, 9 + s.total)
            return (
              <CircleMarker
                key={s.code}
                center={s.pos}
                radius={radius}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 2 }}
              >
                <Tooltip direction="top" opacity={1}>
                  <b>{s.name}</b>{s.affordable > 0 ? ` · 가능 ${s.affordable}건` : ''}
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
        </MapContainer>
      </div>
    </div>
  )
}
