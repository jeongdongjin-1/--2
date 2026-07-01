import { useEffect, useMemo, useState } from 'react'
import { REGIONS, SIDO_LIST, type Region } from '../data/regions'
import { CURRENT_POLICY } from '../data/policy'
import {
  computeAffordability,
  formatWon,
  isRegulated,
  type UserProfile,
} from '../lib/affordability'
import { loadProfile, saveProfile } from '../lib/profileStore'
import { evaluateEligibility } from '../lib/eligibility'

type Trade = {
  apt: string
  dong: string
  area: number
  priceWon: number
  year: number
  month: number
  day: number
  floor: number
  buildYear: number
  lawdCode: string
}

type AptCard = {
  key: string
  apt: string
  dong: string
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
  const [source, setSource] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [error, setError] = useState('')
  const [onlyAffordable, setOnlyAffordable] = useState(true)

  useEffect(() => {
    saveProfile(profile)
  }, [profile])

  const regions = useMemo(() => REGIONS.filter((r) => r.sido === sido), [sido])
  const region = useMemo(() => REGIONS.find((r) => r.code === lawd), [lawd])
  const regulated = region ? isRegulated(region.code, CURRENT_POLICY) : false

  const afford = useMemo(
    () => computeAffordability(profile, CURRENT_POLICY, regulated),
    [profile, regulated]
  )

  const elig = useMemo(() => evaluateEligibility(profile), [profile])

  async function loadTrades() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/trades?lawd=${lawd}&ymd=${ymd}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '조회 실패')
      setTrades(json.items)
      setSource(json.source)
      setReason(json.reason || '')
    } catch (e: any) {
      setError(String(e?.message || e))
      setTrades([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrades()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      area: t.area,
      priceWon: t.priceWon,
      buildYear: t.buildYear,
      lastDeal: `${t.year}.${String(t.month).padStart(2, '0')}.${String(t.day).padStart(2, '0')}`,
      affordable: t.priceWon <= afford.maxPriceWon,
    }))
    list.sort((a, b) => a.priceWon - b.priceWon)
    return list
  }, [trades, afford.maxPriceWon])

  const shown = onlyAffordable ? cards.filter((c) => c.affordable) : cards
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
          <div className="binding">한도 결정: <b>{bindingLabel(afford.binding)}</b></div>
        </section>
      </aside>

      <main className="content">
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
          <label className="check inline">
            <input type="checkbox" checked={onlyAffordable} onChange={(e) => setOnlyAffordable(e.target.checked)} />
            살 수 있는 것만
          </label>
        </section>

        <div className="result-head">
          <div>
            <b>{region?.name}</b> · {ymd.slice(0, 4)}년 {ymd.slice(4, 6)}월 ·
            총 {cards.length}건 중 <b className="ok">{affordableCount}건</b> 입주 가능
          </div>
          <div className="source">
            {source === 'mock'
              ? reason === 'apierror'
                ? '⚠️ 목업 (실거래가 API 일시 오류·재시도 필요)'
                : '⚠️ 목업 (실거래가 키 미설정)'
              : source === 'molit'
                ? '✅ 국토부 실거래가'
                : ''}
          </div>
        </div>

        {error && <div className="error">조회 오류: {error}</div>}

        <div className="cards">
          {shown.map((c) => (
            <div key={c.key} className={`card ${c.affordable ? 'affordable' : 'over'}`}>
              <div className="card-main">
                <div className="card-title">{c.apt}</div>
                <div className="card-meta">{c.dong} · 전용 {c.area}㎡ · {c.buildYear}년 · 최근 {c.lastDeal}</div>
              </div>
              <div className="card-price">
                <div className="price">{formatWon(c.priceWon)}</div>
                <div className={`badge ${c.affordable ? 'ok' : 'no'}`}>
                  {c.affordable ? '입주 가능' : `${formatWon(c.priceWon - afford.maxPriceWon)} 부족`}
                </div>
              </div>
            </div>
          ))}
          {shown.length === 0 && !loading && (
            <div className="empty">
              {onlyAffordable
                ? '조건에 맞는(살 수 있는) 매물이 없어요. 지역/예산을 조정하거나 필터를 꺼보세요.'
                : '거래 데이터가 없습니다.'}
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
