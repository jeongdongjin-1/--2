import { useEffect, useMemo, useRef, useState } from 'react'
import { REGIONS, SIDO_LIST, type Region } from '../data/regions'
import { CURRENT_POLICY } from '../data/policy'
import {
  computeAffordability,
  computeAffordabilityWithCosts,
  formatWon,
  isRegulated,
  type UserProfile,
} from '../lib/affordability'
import { loadProfile, saveProfile, clearProfile, DEFAULT_PROFILE } from '../lib/profileStore'
import { evaluateEligibility } from '../lib/eligibility'
import { fetchLatestTrades, fetchTradesYmd, ymWithOffset } from '../lib/trades'
import { loadFavorites, toggleFavorite, favKey, type FavItem } from '../lib/favorites'
import { naverLandUrl, kakaoMapUrl, openPreciseLink, cleanAptName } from '../lib/links'

type Trade = {
  apt: string
  dong: string
  jibun?: string
  area: number
  priceWon: number
  year: number
  month: number
  day: number
  floor: number
  buildYear: number
  lawdCode: string
}

type HistoryMonth = {
  ymd: string
  count: number
  medianWon: number
  deals: { y: number; m: number; d: number; area: number; floor: number; priceWon: number }[]
}
type HistoryData = { source: string; apt: string; months: HistoryMonth[] }

type AptCard = {
  key: string
  apt: string
  dong: string
  jibun?: string
  area: number
  priceWon: number
  buildYear: number
  lastDeal: string
  affordable: boolean
}

function recentYmd(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function MatchTab() {
  const [profile, setProfile] = useState<UserProfile>(loadProfile())
  const [sido, setSido] = useState<Region['sido']>('서울')
  const [lawd, setLawd] = useState('11680')
  const [ymd, setYmd] = useState(recentYmd())
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(false)
  const [slowHint, setSlowHint] = useState(false) // 무료 서버 콜드스타트 안내
  const [periodLabel, setPeriodLabel] = useState<string | null>(null) // 두 달 합산 시 "7~8월" 라벨
  const [source, setSource] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [error, setError] = useState('')
  const [onlyAffordable, setOnlyAffordable] = useState(true)
  const [areaFilter, setAreaFilter] = useState<'all' | 'small' | 'mid' | 'large'>('all')
  const [ageFilter, setAgeFilter] = useState<'all' | '5' | '10' | '20' | 'old'>('all')
  const [propType, setPropType] = useState<'apt' | 'offi' | 'villa'>('apt')

  useEffect(() => {
    saveProfile(profile)
  }, [profile])

  const regions = useMemo(() => REGIONS.filter((r) => r.sido === sido), [sido])
  const region = useMemo(() => REGIONS.find((r) => r.code === lawd), [lawd])
  const regulated = region ? isRegulated(region.code, CURRENT_POLICY) : false

  const [includeCosts, setIncludeCosts] = useState(true)

  // 관심 단지 즐겨찾기
  const [favorites, setFavorites] = useState<FavItem[]>(loadFavorites())
  function onToggleFav(c: AptCard) {
    const item: FavItem = {
      key: favKey(c.apt, c.area, lawd, propType),
      apt: c.apt,
      area: c.area,
      dong: c.dong,
      lawd,
      regionName: region?.name ?? '',
      type: propType,
      savedPriceWon: c.priceWon,
      savedYmd: ymd,
      savedAt: Date.now(),
    }
    setFavorites(toggleFavorite(item))
  }
  const favKeys = useMemo(() => new Set(favorites.map((f) => f.key)), [favorites])

  // 단지 상세(시세 추이) — 카드 클릭 토글, 이력은 키별 캐시
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [histories, setHistories] = useState<Record<string, HistoryData | 'loading' | 'error'>>({})

  async function toggleDetail(c: AptCard) {
    if (expandedKey === c.key) {
      setExpandedKey(null)
      return
    }
    setExpandedKey(c.key)
    if (histories[c.key]) return
    setHistories((h) => ({ ...h, [c.key]: 'loading' }))
    try {
      const res = await fetch(
        `/api/complex-history?lawd=${lawd}&apt=${encodeURIComponent(c.apt)}&type=${propType}&area=${c.area}&months=12`
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setHistories((h) => ({ ...h, [c.key]: json }))
    } catch {
      setHistories((h) => ({ ...h, [c.key]: 'error' }))
    }
  }

  // 취득비용 포함 여부에 따른 최대 구매가 (85㎡ 초과 매물은 농특세로 한도가 더 낮음)
  const afford = useMemo(
    () =>
      includeCosts
        ? computeAffordabilityWithCosts(profile, CURRENT_POLICY, regulated, false)
        : { ...computeAffordability(profile, CURRENT_POLICY, regulated), costs: null },
    [profile, regulated, includeCosts]
  )
  const maxPriceOver85 = useMemo(
    () =>
      includeCosts
        ? computeAffordabilityWithCosts(profile, CURRENT_POLICY, regulated, true).maxPriceWon
        : afford.maxPriceWon,
    [profile, regulated, includeCosts, afford.maxPriceWon]
  )

  const elig = useMemo(() => evaluateEligibility(profile), [profile])

  // 무료 서버(Render)는 15분 이상 접속이 없으면 잠들어 첫 응답이 최대 1분쯤 걸림 → 5초 넘으면 안내 표시
  function startSlowTimer() {
    setSlowHint(false)
    return window.setTimeout(() => setSlowHint(true), 5000)
  }

  // 수동 조회 — 입력된 연월 그대로
  async function loadTrades() {
    setLoading(true)
    setError('')
    setPeriodLabel(null)
    const t = startSlowTimer()
    try {
      const json = await fetchTradesYmd(lawd, ymd, propType)
      setTrades(json.items)
      setSource(json.source)
      setReason(json.reason || '')
    } catch (e: any) {
      setError(String(e?.message || e))
      setTrades([])
    } finally {
      clearTimeout(t)
      setSlowHint(false)
      setLoading(false)
    }
  }

  // 자동 최신 — 이번 달부터 거슬러 최신 데이터 채택. 최신 달이 빈약하면 직전 달과 합산 표시.
  async function loadLatest() {
    setLoading(true)
    setError('')
    const t = startSlowTimer()
    try {
      const json = await fetchLatestTrades(lawd, propType)
      setYmd(json.dealYmd)
      setTrades(json.items)
      setSource(json.source)
      setReason(json.reason || '')
      if (json.mergedYmds && json.mergedYmds.length === 2) {
        const [a, b] = json.mergedYmds
        setPeriodLabel(`${b.slice(0, 4)}년 ${Number(a.slice(4, 6))}~${Number(b.slice(4, 6))}월`)
      } else {
        setPeriodLabel(null)
      }
    } catch (e: any) {
      setError(String(e?.message || e))
      setTrades([])
    } finally {
      clearTimeout(t)
      setSlowHint(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLatest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propType])

  const cards: AptCard[] = useMemo(() => {
    const map = new Map<string, Trade>()
    for (const t of trades) {
      const key = `${t.apt}|${t.area}`
      const prev = map.get(key)
      const tDate = t.year * 10000 + t.month * 100 + t.day
      const pDate = prev ? prev.year * 10000 + prev.month * 100 + prev.day : -1
      if (!prev || tDate > pDate) map.set(key, t)
    }
    const list = [...map.values()].map((t) => ({
      key: `${t.apt}|${t.area}`,
      apt: t.apt,
      dong: t.dong,
      jibun: t.jibun,
      area: t.area,
      priceWon: t.priceWon,
      buildYear: t.buildYear,
      lastDeal: `${t.year}.${String(t.month).padStart(2, '0')}.${String(t.day).padStart(2, '0')}`,
      // 85㎡ 초과는 농특세(0.2%~)로 한도가 조금 낮음
      affordable: t.priceWon <= (t.area > 85 ? maxPriceOver85 : afford.maxPriceWon),
    }))
    list.sort((a, b) => a.priceWon - b.priceWon)
    return list
  }, [trades, afford.maxPriceWon, maxPriceOver85])

  const shown = cards.filter((c) => {
    if (onlyAffordable && !c.affordable) return false
    if (areaFilter === 'small' && !(c.area < 60)) return false
    if (areaFilter === 'mid' && !(c.area >= 60 && c.area < 85)) return false
    if (areaFilter === 'large' && !(c.area >= 85)) return false
    const age = new Date().getFullYear() - c.buildYear
    if (ageFilter === '5' && age > 5) return false
    if (ageFilter === '10' && age > 10) return false
    if (ageFilter === '20' && age > 20) return false
    if (ageFilter === 'old' && age <= 20) return false
    return true
  })
  const affordableCount = cards.filter((c) => c.affordable).length

  function set<K extends keyof UserProfile>(k: K, v: UserProfile[K]) {
    setProfile((p) => ({ ...p, [k]: v }))
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <section className="panel">
          <h2>내 정보 (개인정보)</h2>
          <Field label="연소득 (부부합산)">
            <MoneyInput value={profile.annualIncomeWon} onChange={(v) => set('annualIncomeWon', v)} />
          </Field>
          <Field label="가용 현금/자산 (자기자본)">
            <MoneyInput value={profile.cashAssetsWon} onChange={(v) => set('cashAssetsWon', v)} />
          </Field>
          <Field label="기존 대출 연 상환액">
            <MoneyInput
              value={profile.existingAnnualDebtPaymentWon}
              onChange={(v) => set('existingAnnualDebtPaymentWon', v)}
            />
          </Field>
          <Field label="보유 주택 수">
            <input
              type="number"
              min={0}
              value={profile.ownedHouses}
              onChange={(e) => set('ownedHouses', Number(e.target.value))}
            />
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={profile.isFirstTime}
              onChange={(e) => set('isFirstTime', e.target.checked)}
            />
            생애최초 주택구입
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={profile.marriedWithin7yr}
              onChange={(e) => set('marriedWithin7yr', e.target.checked)}
            />
            혼인 7년 이내 (신혼부부)
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={profile.newbornWithin2yr}
              onChange={(e) => set('newbornWithin2yr', e.target.checked)}
            />
            2년 내 출산·임신 (신생아)
          </label>
          <Field label="미성년 자녀 수">
            <input
              type="number"
              min={0}
              value={profile.childrenCount}
              onChange={(e) => set('childrenCount', Number(e.target.value))}
            />
          </Field>
          <div className="privacy-row">
            <span className="privacy-note">🔒 입력값은 이 브라우저에만 저장돼요</span>
            <button
              type="button"
              className="reset-btn"
              onClick={() => {
                if (confirm('저장된 내 정보를 초기화할까요?')) {
                  clearProfile()
                  setProfile(DEFAULT_PROFILE)
                }
              }}
            >
              내 정보 초기화
            </button>
          </div>
        </section>

        <section className="panel elig-panel">
          <h2>받을 수 있는 혜택</h2>
          {!elig.hasAny && (
            <p className="elig-empty">
              혼인 7년 이내·2년 내 출산·자녀 2명 이상 중 하나라도 해당하면
              신혼·신생아·다자녀 전용 저리 대출 자격이 생겨요. 위에서 체크해보세요.
            </p>
          )}
          {elig.hasAny && (
            <>
              <div className="elig-tags">
                {elig.matchedInfo.map((h) => (
                  <span key={h.key} className="elig-tag">{h.emoji} {h.title}</span>
                ))}
              </div>
              <ul className="elig-products">
                {elig.products.map((ep) => (
                  <li key={ep.product.id} className={ep.incomeOk ? 'ok' : 'warn'}>
                    <div className="ep-top">
                      <span className={`ep-mark ${ep.incomeOk ? 'ok' : 'warn'}`}>
                        {ep.incomeOk ? '✓' : '!'}
                      </span>
                      <b>{ep.product.name}</b>
                      <span className="ep-rate">{ep.product.rate.split('(')[0].trim()}</span>
                    </div>
                    <div className="ep-note">{ep.note} · 한도 {ep.product.loanLimit}</div>
                  </li>
                ))}
              </ul>
              <p className="tiny-note">
                정확한 자격·우대금리는 <b>기금e든든</b>에서 확인하세요. 자세한 혜택은 ‘신혼·다자녀 혜택’ 탭 참고.
              </p>
            </>
          )}
        </section>

        <section className="panel result-panel">
          <h2>내가 살 수 있는 집</h2>
          <div className="big-number">{formatWon(afford.maxPriceWon)}</div>
          <div className="sub">최대 구매 가능가</div>
          <div className="kv"><span>대출 가능액</span><b>{formatWon(afford.maxLoanWon)}</b></div>
          <div className="kv"><span>자기자본</span><b>{formatWon(profile.cashAssetsWon)}</b></div>
          <div className="kv"><span>적용 LTV</span><b>{Math.round(afford.appliedLtv * 100)}%{regulated ? ' (규제지역)' : ''}</b></div>
          <div className="kv"><span>월 상환 여력</span><b>{formatWon(afford.monthlyPaymentCapWon)}</b></div>
          {afford.costs && (
            <div
              className="kv"
              title={`취득세 ${formatWon(afford.costs.acquisitionTax)} (세율 ${(afford.costs.acqRate * 100).toFixed(1)}%${afford.costs.firstTimeDiscount ? `, 생애최초 −${formatWon(afford.costs.firstTimeDiscount)}` : ''})
지방교육세 ${formatWon(afford.costs.eduTax)}
중개보수(상한) ${formatWon(afford.costs.brokerFee)} · 인지세 ${formatWon(afford.costs.stampDuty)}`}
            >
              <span>취득비용(예상) ⓘ</span>
              <b>{formatWon(afford.costs.total)}</b>
            </div>
          )}
          <label className="check costs-toggle">
            <input type="checkbox" checked={includeCosts} onChange={(e) => setIncludeCosts(e.target.checked)} />
            취득세·중개보수 등 부대비용 반영
          </label>
          <div className="binding">한도 결정: <b>{bindingLabel(afford.binding)}</b></div>
          <p className="disclaimer">
            ⓘ 참고용 추정치입니다. 실제 대출 한도·금리는 은행 심사(소득·신용·부채 등)에 따라 달라지며,
            매물 가격은 <b>과거 실거래가</b>(현재 호가 아님) 기준입니다.
          </p>
        </section>
      </aside>

      <main className="content">
        <div className="proptype-tabs" role="tablist" aria-label="주택 유형">
          {([['apt', '🏢 아파트'], ['offi', '🏬 오피스텔'], ['villa', '🏘️ 빌라']] as const).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={propType === k}
              className={`ptype ${propType === k ? 'on' : ''}`}
              onClick={() => setPropType(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {favorites.length > 0 && (
          <FavPanel favorites={favorites} onRemove={(f) => setFavorites(toggleFavorite(f))} />
        )}

        <section className="filters">
          <select value={sido} onChange={(e) => {
            const s = e.target.value as Region['sido']
            setSido(s)
            const first = REGIONS.find((r) => r.sido === s)
            if (first) setLawd(first.code)
          }}>
            {SIDO_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={lawd} onChange={(e) => setLawd(e.target.value)}>
            {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
          <input
            className="ymd"
            value={ymd}
            maxLength={6}
            onChange={(e) => setYmd(e.target.value.replace(/\D/g, ''))}
            placeholder="YYYYMM"
          />
          <button className="btn-primary" onClick={loadTrades} disabled={loading}>
            {loading ? '조회 중…' : '실거래 조회'}
          </button>
          <select aria-label="전용면적 필터" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value as typeof areaFilter)} title="전용면적">
            <option value="all">전 평형</option>
            <option value="small">소형 (~59㎡)</option>
            <option value="mid">중형 (60~84㎡)</option>
            <option value="large">대형 (85㎡~)</option>
          </select>
          <select aria-label="연식 필터" value={ageFilter} onChange={(e) => setAgeFilter(e.target.value as typeof ageFilter)} title="연식">
            <option value="all">전 연식</option>
            <option value="5">5년 이내</option>
            <option value="10">10년 이내</option>
            <option value="20">20년 이내</option>
            <option value="old">20년 초과</option>
          </select>
          <label className="check inline">
            <input type="checkbox" checked={onlyAffordable} onChange={(e) => setOnlyAffordable(e.target.checked)} />
            살 수 있는 것만
          </label>
        </section>

        <div className="result-head">
          <div>
            {loading ? (
              <>조회 중… {slowHint && <span className="muted-inline">(잠자던 무료 서버를 깨우는 중이에요 — 첫 조회는 최대 1분 걸릴 수 있어요)</span>}</>
            ) : (
              <>
                <b>{region?.name}</b> · {periodLabel ?? `${ymd.slice(0, 4)}년 ${ymd.slice(4, 6)}월`} <span className="muted-inline">실거래</span> ·
                총 {cards.length}건 중 <b className="ok">{affordableCount}건</b> 입주 가능
              </>
            )}
          </div>
          <div className="source">
            {source === 'mock'
              ? reason === 'apierror'
                ? '⚠️ 목업 (실거래가 API 일시 오류)'
                : '⚠️ 목업 (실거래가 키 미설정)'
              : source === 'molit'
                ? '✅ 국토부 실거래가'
                : ''}
            {source === 'mock' && reason === 'apierror' && (
              <button className="retry-btn" onClick={loadTrades} disabled={loading}>재시도</button>
            )}
          </div>
        </div>

        {error && <div className="error">조회 오류: {error}</div>}

        <div className="cards">
          {shown.map((c) => (
            <div key={c.key} className={`card ${c.affordable ? 'affordable' : 'over'} ${expandedKey === c.key ? 'expanded' : ''}`}>
              <div
                className="card-row"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('a')) return // 링크 클릭은 토글 제외
                  toggleDetail(c)
                }}
                role="button"
                aria-expanded={expandedKey === c.key}
                title="클릭하면 최근 12개월 시세 추이를 볼 수 있어요"
              >
                <div className="card-main">
                  <div className="card-title">{c.apt}</div>
                  <div className="card-meta">{c.dong} · 전용 {c.area}㎡ · {c.buildYear}년 · 최근 {c.lastDeal}</div>
                </div>
                <div className="card-price">
                  <button
                    className={`fav-btn ${favKeys.has(favKey(c.apt, c.area, lawd, propType)) ? 'on' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFav(c)
                    }}
                    aria-label="관심 단지 저장"
                    title="관심 단지로 저장"
                  >★</button>
                  <div className="price">{formatWon(c.priceWon)}</div>
                  <div className={`badge ${c.affordable ? 'ok' : 'no'}`}>
                    {c.affordable ? '입주 가능' : `${formatWon(c.priceWon - afford.maxPriceWon)} 부족`}
                  </div>
                </div>
              </div>
              {expandedKey === c.key && (
                <ComplexDetail data={histories[c.key]} />
              )}
              <div className="listing-actions" aria-label="실제 매물 확인">
                <a
                  className="listing-btn naver"
                  href={naverLandUrl({ dong: c.dong, name: c.apt })}
                  onClick={(e) => {
                    e.preventDefault()
                    openPreciseLink('naver', `${region?.name ?? ''} ${cleanAptName(c.apt)}`.trim(), naverLandUrl({ dong: c.dong, name: c.apt }))
                  }}
                  target="_blank" rel="noreferrer"
                >
                  <span className="logo">N</span> 네이버 매물 보기
                </a>
                <a
                  className="listing-btn kakao"
                  href={kakaoMapUrl({ regionName: region?.name, dong: c.dong, jibun: c.jibun, name: c.apt })}
                  onClick={(e) => {
                    e.preventDefault()
                    openPreciseLink('kakao', `${region?.name ?? ''} ${cleanAptName(c.apt)}`.trim(), kakaoMapUrl({ regionName: region?.name, dong: c.dong, jibun: c.jibun, name: c.apt }))
                  }}
                  target="_blank" rel="noreferrer"
                >
                  <span className="logo k">K</span> 카카오맵에서 보기
                </a>
              </div>
            </div>
          ))}
          {shown.length === 0 && !loading && cards.length > 0 && (
            <div className="empty">
              <p>
                이 지역 거래 <b>{cards.length}건</b>이 모두 필터에 걸려 숨겨졌어요
                {onlyAffordable && affordableCount === 0 ? ' (전부 예산 초과)' : ''}.
              </p>
              <button
                className="btn-primary show-all-btn"
                onClick={() => {
                  setOnlyAffordable(false)
                  setAreaFilter('all')
                  setAgeFilter('all')
                }}
              >
                숨겨진 {cards.length}건 모두 보기
              </button>
            </div>
          )}
          {shown.length === 0 && !loading && cards.length === 0 && (
            <div className="empty">
              {'거래 데이터가 없습니다.'}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function bindingLabel(b: string) {
  if (b === 'LTV') return 'LTV(담보비율)'
  if (b === 'DSR') return 'DSR(상환능력)'
  if (b === 'HARD_CAP') return '정책 대출한도'
  return b
}

// 관심 단지 패널 — 저장가 대비 최신 중위가 변동 표시
function FavPanel({ favorites, onRemove }: { favorites: FavItem[]; onRemove: (f: FavItem) => void }) {
  const [latest, setLatest] = useState<Record<string, number | null>>({})
  const inflight = useRef<Set<string>>(new Set())

  // StrictMode 이중 실행에 안전: in-flight 가드 + 완료 시 해제, cleanup으로 결과 버리지 않음
  useEffect(() => {
    const targets = favorites
      .filter((f) => latest[f.key] === undefined && !inflight.current.has(f.key))
      .slice(0, 8)
    if (targets.length === 0) return
    targets.forEach((f) => inflight.current.add(f.key))
    let i = 0
    async function worker() {
      while (i < targets.length) {
        const f = targets[i++]
        try {
          const r = await fetch(
            `/api/complex-history?lawd=${f.lawd}&apt=${encodeURIComponent(f.apt)}&type=${f.type}&area=${f.area}&months=3`
          )
          const j = await r.json()
          const m = [...(j.months || [])].reverse().find((x: HistoryMonth) => x.count > 0)
          setLatest((s) => ({ ...s, [f.key]: m ? m.medianWon : null }))
        } catch {
          setLatest((s) => ({ ...s, [f.key]: null }))
        } finally {
          inflight.current.delete(f.key)
        }
      }
    }
    Promise.all([worker(), worker(), worker()])
  }, [favorites, latest])

  return (
    <section className="fav-panel">
      <h3>⭐ 관심 단지 <span className="fav-count">{favorites.length}</span></h3>
      <ul>
        {favorites.map((f) => {
          const cur = latest[f.key]
          const diff = typeof cur === 'number' ? cur - f.savedPriceWon : null
          return (
            <li key={f.key}>
              <button className="fav-btn on sm" onClick={() => onRemove(f)} aria-label="관심 해제" title="관심 해제">★</button>
              <div className="fav-main">
                <b>{f.apt}</b>
                <span className="fav-meta">{f.regionName} · {f.area}㎡ · 저장 {formatWon(f.savedPriceWon)}</span>
              </div>
              <div className="fav-now">
                {cur === undefined && <span className="fav-loading">조회중…</span>}
                {cur === null && <span className="fav-loading">최근 거래 없음</span>}
                {typeof cur === 'number' && (
                  <>
                    <b>{formatWon(cur)}</b>
                    <span className={`fav-diff ${diff! > 0 ? 'up' : diff! < 0 ? 'down' : ''}`}>
                      {diff === 0 ? '보합' : `${diff! > 0 ? '▲' : '▼'} ${formatWon(Math.abs(diff!))}`}
                    </span>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// 단지 상세 — 12개월 중위가 추이 차트 + 최근 거래 목록
function ComplexDetail({ data }: { data: HistoryData | 'loading' | 'error' | undefined }) {
  if (!data || data === 'loading') return <div className="detail-box loading">시세 이력을 불러오는 중…</div>
  if (data === 'error') return <div className="detail-box loading">이력을 불러오지 못했어요. 다시 눌러보세요.</div>

  const pts = data.months.filter((m) => m.count > 0)
  const recentDeals = [...data.months].reverse().flatMap((m) =>
    m.deals.map((d) => ({ ...d, ymd: m.ymd }))
  ).slice(0, 6)

  return (
    <div className="detail-box">
      <div className="detail-head">
        <b>최근 12개월 시세 추이</b>
        <span className="detail-src">{data.source === 'molit' ? '국토부 실거래' : '목업'}</span>
      </div>
      {pts.length === 0 ? (
        <p className="trend-empty">최근 12개월 이 평형의 거래가 없어요.</p>
      ) : (
        <TrendChart pts={pts} />
      )}
      {recentDeals.length > 0 && (
        <ul className="deal-list">
          {recentDeals.map((d, i) => (
            <li key={i}>
              <span className="deal-date">{String(d.y).slice(2)}.{String(d.m).padStart(2, '0')}.{String(d.d).padStart(2, '0')}</span>
              <span className="deal-meta">{d.floor}층 · {d.area}㎡</span>
              <b>{formatWon(d.priceWon)}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TrendChart({ pts }: { pts: HistoryMonth[] }) {
  const W = 560, H = 130, P = 34
  const vals = pts.map((p) => p.medianWon)
  const min = Math.min(...vals), max = Math.max(...vals)
  const x = (i: number) => (pts.length === 1 ? W / 2 : P + ((W - 2 * P) * i) / (pts.length - 1))
  const y = (v: number) => (max === min ? H / 2 : P + (H - 2 * P) * (1 - (v - min) / (max - min)))
  const line = pts.map((p, i) => `${x(i)},${y(p.medianWon)}`).join(' ')
  const eok = (v: number) => (v / 100_000_000).toFixed(1)
  const first = pts[0], last = pts[pts.length - 1]
  const diff = last.medianWon - first.medianWon
  const up = diff > 0

  return (
    <div className="trend-wrap">
      <div className={`trend-delta ${up ? 'up' : diff < 0 ? 'down' : ''}`}>
        {pts.length > 1
          ? `${first.ymd.slice(4)}월 대비 ${diff === 0 ? '보합' : `${up ? '▲' : '▼'} ${formatWon(Math.abs(diff))}`}`
          : '거래 1개월'}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" role="img" aria-label="월별 중위 실거래가 추이">
        <polyline points={line} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.medianWon)} r="3.6" fill="var(--brand)" />
            <text x={x(i)} y={H - 8} textAnchor="middle" className="tc-month">{Number(p.ymd.slice(4))}월</text>
            {(i === 0 || i === pts.length - 1 || p.medianWon === max || p.medianWon === min) && (
              <text x={x(i)} y={y(p.medianWon) - 9} textAnchor="middle" className="tc-val">{eok(p.medianWon)}억</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

function MoneyInput({ value, onChange }: { value: number; onChange: (won: number) => void }) {
  const man = Math.round(value / 10_000)
  return (
    <div className="money">
      <input type="number" min={0} step={100} value={man} onChange={(e) => onChange(Number(e.target.value) * 10_000)} />
      <span>만원</span>
    </div>
  )
}
