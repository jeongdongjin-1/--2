import { useMemo, useState } from 'react'
import {
  HOUSEHOLD_INFO,
  LOAN_PRODUCTS,
  type Household,
} from '../data/benefits'

export default function BenefitsTab() {
  const [active, setActive] = useState<Household>('newlywed')
  const info = HOUSEHOLD_INFO.find((h) => h.key === active)!

  const products = useMemo(
    () => LOAN_PRODUCTS.filter((p) => p.households.includes(active)),
    [active]
  )

  return (
    <div className="tab-scroll">
      <div className="household-tabs">
        {HOUSEHOLD_INFO.map((h) => (
          <button
            key={h.key}
            className={`hh-pill ${active === h.key ? 'on' : ''}`}
            onClick={() => setActive(h.key)}
          >
            <span className="emoji">{h.emoji}</span> {h.title}
          </button>
        ))}
      </div>

      <section className="hero-card">
        <div className="hero-emoji">{info.emoji}</div>
        <div>
          <h2>{info.title} 혜택</h2>
          <p className="hero-sub">{info.summary}</p>
        </div>
      </section>

      <div className="benefit-grid">
        <section className="panel">
          <h3>핵심 혜택</h3>
          <ul className="benefit-list">
            {info.benefits.map((b, i) => (
              <li key={i}><span className="dot">✓</span>{b}</li>
            ))}
          </ul>
        </section>
        <section className="panel basis-panel">
          <h3>근거 정책</h3>
          <ul className="basis-list">
            {info.basis.map((b, i) => (
              <li key={i}>📜 {b}</li>
            ))}
          </ul>
          <p className="tiny-note">
            ※ 소득·자산 요건과 금리는 자주 바뀝니다. 신청 가능 여부는
            <b> 기금e든든(nhuf.molit.go.kr)</b> / <b>청약홈</b>에서 확인하세요.
          </p>
        </section>
      </div>

      <h3 className="section-title">해당 대출 상품 ({products.length})</h3>
      <div className="loan-grid">
        {products.map((p) => (
          <div key={p.id} className="loan-card">
            <div className="loan-head">
              <span className={`cat ${p.category === '구입자금' ? 'buy' : 'rent'}`}>{p.category}</span>
              <h4>{p.name}</h4>
            </div>
            <div className="loan-rate">{p.rate}</div>
            <table className="loan-table">
              <tbody>
                <tr><th>소득요건</th><td>{p.incomeLimit}</td></tr>
                {p.assetLimit && <tr><th>자산요건</th><td>{p.assetLimit}</td></tr>}
                <tr><th>대상주택</th><td>{p.targetPrice}</td></tr>
                <tr><th>대출한도</th><td><b>{p.loanLimit}</b></td></tr>
              </tbody>
            </table>
            <ul className="loan-highlights">
              {p.highlights.map((h, i) => <li key={i}>{h}</li>)}
            </ul>
            <div className="loan-basis">📜 {p.basis}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
