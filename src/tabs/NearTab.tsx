import { useMemo, useState } from 'react'
import { REGIONS, REGION_COORDS } from '../data/regions'
import { CURRENT_POLICY } from '../data/policy'
import { computeAffordabilityWithCosts, formatWon, isRegulated } from '../lib/affordability'
import { loadProfile } from '../lib/profileStore'
import { haversineKm, loadWorkplace, saveWorkplace, type Workplace } from '../lib/geo'
import { naverLandUrl, kakaoMapUrl, openPreciseLink, cleanAptName } from '../lib/links'

type NearPick = {
  apt: string
  dong: string
  jibun?: string
  regionName: string
  lawd: string
  medianPrice: number
  medianArea: number
  buildYear: number
  count: number
  discountPct: number
  benchScope: string
  score: number
  trendPct: number | null
  km: number
  lat: number
  lng: number
}

const RADII = [3, 5, 10, 15] as const

// 동시 실행 제한 러너
async function runLimited<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  let i = 0
  async function next() {
    while (i < items.length) {
      const cur = items[i++]
      out.push(await worker(cur))
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next))
  return out
}

export default function NearTab() {
  const [wp, setWp] = useState<Workplace | null>(loadWorkplace())
  const [wpInput, setWpInput] = useState('')
  const [wpError, setWpError] = useState('')
  const [radius, setRadius] = useState<number>(10)
  const [propType, setPropType] = useState<'apt' | 'offi' | 'villa'>('apt')
  const [budgetOnly, setBudgetOnly] = useState(false)
  const [picks, setPicks] = useState<NearPick[]>([])
  const [progress, setProgress] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)

  const profile = useMemo(() => loadProfile(), [])

  // 근무지 설정(지오코딩)
  async function setWorkplace() {
    const q = wpInput.trim()
    if (!q) return
    setWpError('')
    try {
      const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      const j = await r.json()
      if (!j.result?.precise) {
        setWpError('위치를 찾지 못했어요. 회사명+지역(예: "판교 카카오") 또는 주소로 입력해보세요.')
        return
      }
      const w: Workplace = { label: q, place: j.result.place, lat: j.result.lat, lng: j.result.lng }
      setWp(w)
      saveWorkplace(w)
      setPicks([])
      setAnalyzed(false)
    } catch {
      setWpError('조회 중 오류가 났어요. 잠시 후 다시 시도해주세요.')
    }
  }

  // 반경 내 후보 시군구 (구 중심 기준 + 6km 버퍼, 가까운 순 최대 6곳)
  const candidateGus = useMemo(() => {
    if (!wp) return []
    return REGIONS
      .filter((r) => REGION_COORDS[r.code])
      .map((r) => ({ ...r, dist: haversineKm(wp.lat, wp.lng, ...REGION_COORDS[r.code]) }))
      .filter((r) => r.dist <= radius + 6)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6)
  }, [wp, radius])

  async function analyze() {
    if (!wp || candidateGus.length === 0) return
    setAnalyzing(true)
    setPicks([])
    setAnalyzed(false)
    const found: NearPick[] = []
    let done = 0

    for (const gu of candidateGus) {
      setProgress(`${gu.name} 분석 중… (${++done}/${candidateGus.length})`)
      try {
        const res = await fetch(`/api/value-picks?lawd=${gu.code}&type=${propType}`)
        const json = await res.json()
        const top = (json.picks || []).slice(0, 12)
        const located = await runLimited(top, 4, async (p: any) => {
          try {
            const g = await fetch(`/api/geocode?q=${encodeURIComponent(`${gu.name} ${cleanAptName(p.apt)}`)}`)
            const gj = await g.json()
            if (!gj.result?.precise) return null
            const km = haversineKm(wp.lat, wp.lng, gj.result.lat, gj.result.lng)
            if (km > radius) return null
            return {
              apt: p.apt, dong: p.dong, jibun: p.jibun, regionName: gu.name, lawd: gu.code,
              medianPrice: p.medianPrice, medianArea: p.medianArea, buildYear: p.buildYear,
              count: p.count, discountPct: p.discountPct, benchScope: p.benchScope,
              score: p.score, trendPct: p.trendPct,
              km: Math.round(km * 10) / 10, lat: gj.result.lat, lng: gj.result.lng,
            } as NearPick
          } catch {
            return null
          }
        })
        found.push(...(located.filter(Boolean) as NearPick[]))
        setPicks([...found].sort((a, b) => b.score - a.score))
      } catch {
        // 해당 구 실패 시 건너뜀
      }
    }
    setProgress('')
    setAnalyzing(false)
    setAnalyzed(true)
  }

  const budgetFor = (lawd: string) =>
    computeAffordabilityWithCosts(profile, CURRENT_POLICY, isRegulated(lawd, CURRENT_POLICY)).maxPriceWon

  const shown = budgetOnly ? picks.filter((p) => p.medianPrice <= budgetFor(p.lawd)) : picks

  return (
    <div className="tab-scroll near-tab">
      <section className="hero-card near-hero">
        <div className="hero-emoji">📍</div>
        <div>
          <h2>직주근접 가성비</h2>
          <p className="hero-sub">
            근무지에서 <b>원하는 반경 안</b>의 단지를 AI 가성비 스코어로 찾아줍니다.
            거리(직선 기준)와 근거를 함께 표시해요.
          </p>
        </div>
      </section>

      {/* 근무지 설정 */}
      <section className="panel wp-panel">
        <h3>내 근무지</h3>
        {wp ? (
          <div className="wp-set">
            <span className="wp-place">📍 {wp.place}</span>
            <button className="reset-btn" onClick={() => { setWp(null); saveWorkplace(null); setPicks([]); setAnalyzed(false) }}>변경</button>
          </div>
        ) : (
          <div className="wp-form">
            <input
              value={wpInput}
              onChange={(e) => setWpInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setWorkplace()}
              placeholder="회사명 또는 주소 (예: 판교 카카오, 강남역, 테헤란로 152)"
              aria-label="근무지 검색"
            />
            <button className="btn-primary" onClick={setWorkplace}>설정</button>
          </div>
        )}
        {wpError && <p className="wp-error">{wpError}</p>}
      </section>

      {wp && (
        <>
          <section className="filters">
            <span className="radius-chips" role="radiogroup" aria-label="반경">
              {RADII.map((r) => (
                <button key={r} role="radio" aria-checked={radius === r}
                  className={`radius-chip ${radius === r ? 'on' : ''}`}
                  onClick={() => { setRadius(r); setAnalyzed(false) }}>
                  {r}km
                </button>
              ))}
            </span>
            <select aria-label="주택 유형" value={propType} onChange={(e) => { setPropType(e.target.value as typeof propType); setAnalyzed(false) }}>
              <option value="apt">🏢 아파트</option>
              <option value="offi">🏬 오피스텔</option>
              <option value="villa">🏘️ 빌라</option>
            </select>
            <button className="btn-primary" onClick={analyze} disabled={analyzing}>
              {analyzing ? '분석 중…' : `반경 ${radius}km 분석`}
            </button>
            <label className="check inline">
              <input type="checkbox" checked={budgetOnly} onChange={(e) => setBudgetOnly(e.target.checked)} />
              내 예산 내만
            </label>
          </section>

          <div className="result-head">
            <div>
              후보 지역: {candidateGus.map((g) => g.name).join(' · ') || '반경 내 시군구 없음'}
              {analyzed && <> · 반경 내 <b className="ok">{shown.length}곳</b></>}
            </div>
            {progress && <div className="source">{progress}</div>}
          </div>

          <div className="value-list">
            {shown.map((p, i) => {
              const affordable = p.medianPrice <= budgetFor(p.lawd)
              return (
                <div key={p.apt + p.lawd + p.medianArea} className={`value-card ${affordable ? 'affordable' : ''}`}>
                  <div className="v-rank">{i + 1}</div>
                  <div className="v-score"><b>{p.score}</b><span>점</span></div>
                  <div className="v-main">
                    <div className="v-title">
                      {p.apt}
                      <span className="dist-chip">🚶 {p.km}km</span>
                      {affordable && <span className="badge ok">예산 내</span>}
                    </div>
                    <div className="v-meta">{p.regionName} {p.dong} · 전용 {p.medianArea}㎡대 · {p.buildYear}년 · 중위 <b>{formatWon(p.medianPrice)}</b></div>
                    <div className="v-reasons">
                      <span className={`v-chip ${p.discountPct > 0 ? 'good' : 'bad'}`}>
                        {p.benchScope} 대비 {p.discountPct > 0 ? `-${p.discountPct}%` : `+${Math.abs(p.discountPct)}%`}
                      </span>
                      <span className="v-chip">3개월 {p.count}건</span>
                      {p.trendPct != null && (
                        <span className={`v-chip ${p.trendPct >= 0 ? 'good' : 'warn'}`}>
                          {p.trendPct >= 0 ? '▲' : '▼'} {Math.abs(Math.round(p.trendPct * 1000) / 10)}%
                        </span>
                      )}
                    </div>
                    <div className="listing-actions compact">
                      <a className="listing-btn naver" href={naverLandUrl({ name: p.apt, lat: p.lat, lng: p.lng })}
                        target="_blank" rel="noreferrer"><span className="logo">N</span> 매물 보기</a>
                      <a className="listing-btn kakao" href={kakaoMapUrl({ regionName: p.regionName, dong: p.dong, jibun: p.jibun, name: p.apt })}
                        onClick={(e) => { e.preventDefault(); openPreciseLink('kakao', `${p.regionName} ${cleanAptName(p.apt)}`, kakaoMapUrl({ regionName: p.regionName, dong: p.dong, jibun: p.jibun, name: p.apt })) }}
                        target="_blank" rel="noreferrer"><span className="logo k">K</span> 지도</a>
                    </div>
                  </div>
                </div>
              )
            })}
            {analyzed && shown.length === 0 && (
              <div className="empty">
                반경 {radius}km 안에서 조건에 맞는 단지를 못 찾았어요 — 반경을 넓히거나 유형·예산 조건을 바꿔보세요.
              </div>
            )}
            {!analyzed && !analyzing && (
              <div className="empty">반경과 유형을 고르고 <b>분석</b>을 눌러주세요.</div>
            )}
          </div>

          <p className="tiny-note">
            ⓘ 거리는 <b>직선 기준</b>입니다(실제 통근 시간은 대중교통·도로에 따라 다름). 가성비 점수는 실거래 기반
            규칙형 스코어링이며, 반경 내 후보는 가까운 시군구 최대 6곳의 상위 단지에서 찾습니다.
          </p>
        </>
      )}
    </div>
  )
}
