import { useEffect, useMemo, useState } from 'react'
import { CURRENT_POLICY } from '../data/policy'
import { formatWon, type UserProfile } from '../lib/affordability'
import { analyzeStrategy, type Priority } from '../lib/strategy'
import { loadProfile, saveProfile } from '../lib/profileStore'

const PRIORITIES: { key: Priority; label: string; desc: string }[] = [
  { key: 'time', label: '⏳ 시간 여유형', desc: '기다릴 수 있음 → 청약 위주' },
  { key: 'money', label: '💰 자금 여유형', desc: '빠른 입주 원함 → 매매 위주' },
  { key: 'compare', label: '⚖️ 비교만', desc: '둘 다 보고 판단' },
]

export default function StrategyTab() {
  const [profile, setProfile] = useState<UserProfile>(loadProfile())
  const [priority, setPriority] = useState<Priority>('compare')

  useEffect(() => {
    saveProfile(profile)
  }, [profile])

  function set<K extends keyof UserProfile>(k: K, v: UserProfile[K]) {
    setProfile((p) => ({ ...p, [k]: v }))
  }

  const r = useMemo(() => analyzeStrategy(profile, CURRENT_POLICY, priority), [profile, priority])
  const { buy, subscribe, tips, recommendation } = r

  return (
    <div className="layout">
      <aside className="sidebar">
        <section className="panel">
          <h2>내 자금·조건</h2>
          <div className="field">
            <label>연소득 (부부합산)</label>
            <Money value={profile.annualIncomeWon} onChange={(v) => set('annualIncomeWon', v)} />
          </div>
          <div className="field">
            <label>가용 현금/자산</label>
            <Money value={profile.cashAssetsWon} onChange={(v) => set('cashAssetsWon', v)} />
          </div>
          <label className="check">
            <input type="checkbox" checked={profile.isFirstTime} onChange={(e) => set('isFirstTime', e.target.checked)} />
            생애최초 · 무주택
          </label>
          <label className="check">
            <input type="checkbox" checked={profile.marriedWithin7yr} onChange={(e) => set('marriedWithin7yr', e.target.checked)} />
            혼인 7년 이내 (신혼)
          </label>
          <label className="check">
            <input type="checkbox" checked={profile.newbornWithin2yr} onChange={(e) => set('newbornWithin2yr', e.target.checked)} />
            2년 내 출산 (신생아)
          </label>
          <div className="field" style={{ marginTop: 10 }}>
            <label>미성년 자녀 수</label>
            <input type="number" min={0} value={profile.childrenCount}
              onChange={(e) => set('childrenCount', Number(e.target.value))} />
          </div>
        </section>

        <section className="panel">
          <h2>우선순위 성향</h2>
          <div className="prio-list">
            {PRIORITIES.map((p) => (
              <button
                key={p.key}
                className={`prio ${priority === p.key ? 'on' : ''}`}
                onClick={() => setPriority(p.key)}
                aria-pressed={priority === p.key}
              >
                <b>{p.label}</b>
                <span>{p.desc}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <main className="strategy-main">
        {/* 추천 배너 */}
        <section className={`reco-banner pick-${recommendation.pick}`}>
          <h2>{recommendation.headline}</h2>
          <ul>
            {recommendation.reasons.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </section>

        {/* 두 루트 카드 */}
        <div className="route-grid">
          <section className="route-card subscribe">
            <div className="route-head">🎯 청약 (분양)</div>
            {subscribe.eligible ? (
              <>
                <div className="route-big">{formatWon(subscribe.affordablePresaleWon)}</div>
                <div className="route-sub">감당 가능 분양가</div>
                <div className="kv"><span>시세 환산가치</span><b>{formatWon(subscribe.marketValueEquivWon)}</b></div>
                <div className="kv"><span>정책대출</span><b>{formatWon(subscribe.loanLimitWon)} · {subscribe.productRate}</b></div>
                <div className="kv"><span>필요 자기자본</span><b>{formatWon(subscribe.ownCapitalWon)}</b></div>
                <div className="kv"><span>대표 상품</span><b className="small">{subscribe.productName}</b></div>
                <ul className="route-pros">
                  <li className="pro">분양가가 시세보다 저렴(추정) · 저리 정책대출</li>
                  <li className="pro">특별공급 물량으로 경쟁 완화</li>
                  <li className="con">당첨 불확실 · 입주까지 대기(2~3년)</li>
                  <li className="con">청약통장·무주택 유지 필요</li>
                </ul>
              </>
            ) : (
              <div className="route-empty">
                현재 특별공급 <b>정책대출 자격이 없습니다</b>(무주택·가구요건·소득요건 확인).
                생애최초·일반공급 청약(가점·추첨)은 가능하지만 저리 정책대출 이점은 제한적입니다.
                왼쪽에서 조건을 체크해보세요.
              </div>
            )}
          </section>

          <section className="route-card buy">
            <div className="route-head">🏠 매매 (즉시 구입)</div>
            <div className="route-big">{formatWon(buy.maxPriceNonRegulatedWon)}</div>
            <div className="route-sub">최대 구매가 (비규제 기준)</div>
            <div className="kv"><span>규제지역 기준</span><b>{formatWon(buy.maxPriceRegulatedWon)}</b></div>
            <div className="kv"><span>대출액</span><b>{formatWon(buy.loanWon)}</b></div>
            <div className="kv"><span>필요 자기자본</span><b>{formatWon(buy.ownCapitalWon)}</b></div>
            <div className="kv" title={`취득세 ${formatWon(buy.costs.acquisitionTax)} · 교육세 ${formatWon(buy.costs.eduTax)} · 중개보수 ${formatWon(buy.costs.brokerFee)} · 인지세 ${formatWon(buy.costs.stampDuty)}`}>
              <span>취득비용(예상) ⓘ</span><b>{formatWon(buy.costs.total)}</b>
            </div>
            <ul className="route-pros">
              <li className="pro">즉시 입주 · 매물 자유 선택</li>
              <li className="pro">청약통장·무주택 유지 부담 없음</li>
              <li className="con">시세 전액 필요 · 초기 자금 큼</li>
              <li className="con">대출 금리가 정책대출보다 높음</li>
            </ul>
          </section>
        </div>

        {/* 비교표 */}
        <h3 className="section-title">항목별 비교</h3>
        <div className="compare-wrap">
          <table className="compare-table">
            <thead>
              <tr><th>항목</th><th className="col-mil">🎯 청약</th><th className="col-priv">🏠 매매</th></tr>
            </thead>
            <tbody>
              <tr><td className="aspect">감당 가격</td><td>{subscribe.eligible ? `분양가 ${formatWon(subscribe.affordablePresaleWon)} (시세 ${formatWon(subscribe.marketValueEquivWon)})` : '-'}</td><td>{formatWon(buy.maxPriceNonRegulatedWon)}</td></tr>
              <tr><td className="aspect">초기 자기자본</td><td>{subscribe.eligible ? formatWon(subscribe.ownCapitalWon) : '-'}</td><td className="best">{formatWon(buy.ownCapitalWon)} 전액</td></tr>
              <tr><td className="aspect">대출 금리</td><td className="best">저리 정책대출 {subscribe.productRate || '(자격 시)'}</td><td>시중 주담대(높음)</td></tr>
              <tr><td className="aspect">입주 시점</td><td>당첨 후 2~3년</td><td className="best">즉시</td></tr>
              <tr><td className="aspect">확실성</td><td>당첨 불확실</td><td className="best">확정</td></tr>
              <tr><td className="aspect">가격 이점</td><td className="best">분양가 저렴(추정)</td><td>시세 그대로</td></tr>
              <tr><td className="aspect">유지 조건</td><td>청약통장·무주택</td><td className="best">없음</td></tr>
            </tbody>
          </table>
        </div>

        {/* 가구 유형별 전략 팁 */}
        {tips.length > 0 && (
          <>
            <h3 className="section-title">내 가구 맞춤 전략</h3>
            <div className="benefit-grid">
              {tips.map((t, i) => (
                <section key={i} className="panel tip-card">
                  <h3>{t.title}</h3>
                  <p>{t.body}</p>
                </section>
              ))}
            </div>
          </>
        )}

        <p className="tiny-note">
          ⓘ 참고용 분석입니다. 분양가는 <b>시세의 85%로 가정</b>(단지별 상이), 매매 최대가는 대출한도 추정치이며
          실제 당첨·대출·가격은 청약경쟁률·은행 심사·시장에 따라 달라집니다. 정책 기준: {CURRENT_POLICY.effectiveDate}.
        </p>
      </main>
    </div>
  )
}

function Money({ value, onChange }: { value: number; onChange: (won: number) => void }) {
  const man = Math.round(value / 10_000)
  return (
    <div className="money">
      <input type="number" min={0} step={100} value={man} aria-label="금액(만원)"
        onChange={(e) => onChange(Number(e.target.value) * 10_000)} />
      <span>만원</span>
    </div>
  )
}
