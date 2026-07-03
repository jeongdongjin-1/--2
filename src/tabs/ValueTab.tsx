import { useEffect, useMemo, useState } from 'react'
import { REGIONS, SIDO_LIST, type Region } from '../data/regions'
import { CURRENT_POLICY } from '../data/policy'
import { computeAffordabilityWithCosts, formatWon, isRegulated } from '../lib/affordability'
import { loadProfile } from '../lib/profileStore'
import { naverLandUrl, kakaoMapUrl, openPreciseLink, cleanAptName } from '../lib/links'
import { AREA_BANDS, matchArea, type AreaBand } from '../lib/areaBands'

type Pick = {
  apt: string
  dong: string
  jibun?: string
  bucket: number
  count: number
  medianPrice: number
  medianArea: number
  buildYear: number
  trendPct: number | null
  discountPct: number
  benchScope: string // 예: '동 중형' / '구 대형' / '구 전체'
  score: number
  parts: { 저평가: number; 연식: number; 유동성: number; 추세: number }
}

const PTYPE_LABEL = { apt: '아파트', offi: '오피스텔', villa: '빌라' } as const

export default function ValueTab() {
  const [sido, setSido] = useState<Region['sido']>('서울')
  const [lawd, setLawd] = useState('11680')
  const [propType, setPropType] = useState<'apt' | 'offi' | 'villa'>('apt')
  const [picks, setPicks] = useState<Pick[]>([])
  const [monthsUsed, setMonthsUsed] = useState<string[]>([])
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(false)
  const [budgetOnly, setBudgetOnly] = useState(false)
  const [areaBand, setAreaBand] = useState<AreaBand>('all')

  const profile = useMemo(() => loadProfile(), [])
  const regions = useMemo(() => REGIONS.filter((r) => r.sido === sido), [sido])
  const region = useMemo(() => REGIONS.find((r) => r.code === lawd), [lawd])
  const budget = useMemo(
    () => computeAffordabilityWithCosts(profile, CURRENT_POLICY, region ? isRegulated(region.code, CURRENT_POLICY) : false).maxPriceWon,
    [profile, region]
  )

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/value-picks?lawd=${lawd}&type=${propType}&top=40`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setPicks(json.picks || [])
      setMonthsUsed(json.monthsUsed || [])
      setSource(json.source || '')
    } catch {
      setPicks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lawd, propType])

  const shown = picks
    .filter((p) => matchArea(p.medianArea, areaBand))
    .filter((p) => !budgetOnly || p.medianPrice <= budget)

  return (
    <div className="tab-scroll value-tab">
      <section className="hero-card value-hero">
        <div className="hero-emoji">🤖</div>
        <div>
          <h2>AI 가성비 분석</h2>
          <p className="hero-sub">
            최근 실거래를 분석해 <b>같은 동네·같은 평형 대비 저평가된 단지</b>를 찾아 순위를 매깁니다.
            저평가(45%) · 연식(20%) · 거래 활발도(20%) · 추세(15%) 가중 — 근거는 카드에 전부 공개돼요.
          </p>
        </div>
      </section>

      <section className="filters">
        <select aria-label="시도" value={sido} onChange={(e) => {
          const s = e.target.value as Region['sido']
          setSido(s)
          const first = REGIONS.find((r) => r.sido === s)
          if (first) setLawd(first.code)
        }}>
          {SIDO_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select aria-label="시군구" value={lawd} onChange={(e) => setLawd(e.target.value)}>
          {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
        </select>
        <select aria-label="주택 유형" value={propType} onChange={(e) => setPropType(e.target.value as typeof propType)}>
          <option value="apt">🏢 아파트</option>
          <option value="offi">🏬 오피스텔</option>
          <option value="villa">🏘️ 빌라</option>
        </select>
        <select aria-label="평수(전용면적)" value={areaBand} onChange={(e) => setAreaBand(e.target.value as AreaBand)}>
          {AREA_BANDS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
        </select>
        <label className="check inline">
          <input type="checkbox" checked={budgetOnly} onChange={(e) => setBudgetOnly(e.target.checked)} />
          내 예산({formatWon(budget)}) 내만
        </label>
      </section>

      <div className="result-head">
        <div>
          <b>{region?.name}</b> {PTYPE_LABEL[propType]} · 분석기간 {monthsUsed.map((m) => `${Number(m.slice(4))}월`).join('·')} ·
          가성비 상위 <b className="ok">{shown.length}</b>곳
        </div>
        <div className="source">{source === 'molit' ? '✅ 국토부 실거래 분석' : '⚠️ 목업 분석'}</div>
      </div>

      {loading && <p className="tiny-note">최근 3개월 실거래를 분석하는 중…</p>}

      <div className="value-list">
        {shown.map((p, i) => {
          const affordable = p.medianPrice <= budget
          return (
            <div key={p.apt + p.bucket} className={`value-card ${affordable ? 'affordable' : ''}`}>
              <div className="v-rank">{i + 1}</div>
              <div className="v-score" title={`저평가 ${p.parts.저평가} · 연식 ${p.parts.연식} · 유동성 ${p.parts.유동성} · 추세 ${p.parts.추세}`}>
                <b>{p.score}</b><span>점</span>
              </div>
              <div className="v-main">
                <div className="v-title">
                  {p.apt}
                  {affordable && <span className="badge ok">예산 내</span>}
                </div>
                <div className="v-meta">{p.dong} · 전용 {p.medianArea}㎡대 · {p.buildYear}년 · 중위 <b>{formatWon(p.medianPrice)}</b></div>
                <div className="v-reasons">
                  <span className={`v-chip ${p.discountPct > 0 ? 'good' : 'bad'}`}>
                    {p.benchScope} 시세 대비 {p.discountPct > 0 ? `-${p.discountPct}% 저렴` : `+${Math.abs(p.discountPct)}%`}
                  </span>
                  <span className="v-chip">3개월 {p.count}건 거래</span>
                  {p.trendPct != null && (
                    <span className={`v-chip ${p.trendPct >= 0 ? 'good' : 'warn'}`}>
                      추세 {p.trendPct >= 0 ? '▲' : '▼'} {Math.abs(Math.round(p.trendPct * 1000) / 10)}%
                    </span>
                  )}
                </div>
                <div className="listing-actions compact">
                  <a className="listing-btn naver" href={naverLandUrl({ dong: p.dong, name: p.apt })}
                    onClick={(e) => { e.preventDefault(); openPreciseLink('naver', `${region?.name ?? ''} ${cleanAptName(p.apt)}`.trim(), naverLandUrl({ dong: p.dong, name: p.apt })) }}
                    target="_blank" rel="noreferrer"><span className="logo">N</span> 매물 보기</a>
                  <a className="listing-btn kakao" href={kakaoMapUrl({ regionName: region?.name, dong: p.dong, jibun: p.jibun, name: p.apt })}
                    onClick={(e) => { e.preventDefault(); openPreciseLink('kakao', `${region?.name ?? ''} ${cleanAptName(p.apt)}`.trim(), kakaoMapUrl({ regionName: region?.name, dong: p.dong, jibun: p.jibun, name: p.apt })) }}
                    target="_blank" rel="noreferrer"><span className="logo k">K</span> 지도</a>
                </div>
              </div>
            </div>
          )
        })}
        {!loading && shown.length === 0 && (
          <div className="empty">
            {budgetOnly ? '예산 내 가성비 단지가 없어요 — 체크를 풀거나 지역을 바꿔보세요.' : '분석할 거래가 부족해요(최근 3개월 2건 이상 필요).'}
          </div>
        )}
      </div>

      <p className="tiny-note">
        ⓘ 실거래 데이터 기반 <b>규칙형 스코어링</b>입니다(저평가는 같은 {`{동/구}`}·비슷한 평형의 ㎡당가 비교).
        저평가에는 저층·향·수리상태 등 개별 사유가 있을 수 있으니 반드시 매물 확인·임장으로 검증하세요. 투자 조언이 아닙니다.
      </p>
    </div>
  )
}
