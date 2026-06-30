import { MILITARY_BENEFITS, MILITARY_COMPARE } from '../data/military'

const EDGE_LABEL: Record<string, string> = {
  military: '군인공제',
  govFund: '정부기금',
  privateBank: '민간은행',
  mixed: '상황별',
}

export default function MilitaryTab() {
  return (
    <div className="tab-scroll">
      <section className="hero-card mil">
        <div className="hero-emoji">🎖️</div>
        <div>
          <h2>군인공제회 vs 민간 비교</h2>
          <p className="hero-sub">
            직업군인(군인공제회 회원)이 받을 수 있는 주택 혜택을 정부 지원 대출·민간 시중은행과 나란히 비교합니다.
            보통 <b>금리는 정부 기금이 가장 낮고</b>, <b>저축·완화된 요건은 공제회가 유리</b>합니다.
          </p>
        </div>
      </section>

      <div className="benefit-grid">
        {MILITARY_BENEFITS.map((b, i) => (
          <section key={i} className="panel">
            <h3>{b.title}</h3>
            <p className="mil-desc">{b.desc}</p>
            <div className="loan-basis">📜 {b.basis}</div>
          </section>
        ))}
      </div>

      <h3 className="section-title">항목별 비교</h3>
      <div className="compare-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th>비교 항목</th>
              <th className="col-mil">🎖️ 군인공제회</th>
              <th className="col-gov">🏛️ 정부 지원대출</th>
              <th className="col-priv">🏦 민간 시중은행</th>
              <th>유리</th>
            </tr>
          </thead>
          <tbody>
            {MILITARY_COMPARE.map((r, i) => (
              <tr key={i}>
                <td className="aspect">{r.aspect}</td>
                <td className={r.edge === 'military' ? 'best' : ''}>{r.military}</td>
                <td className={r.edge === 'govFund' ? 'best' : ''}>{r.govFund}</td>
                <td className={r.edge === 'privateBank' ? 'best' : ''}>{r.privateBank}</td>
                <td><span className={`edge-tag ${r.edge}`}>{EDGE_LABEL[r.edge]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="panel strategy">
        <h3>💡 추천 조합</h3>
        <p>
          <b>① 자기자본은 군인공제회 저축(복리)</b>으로 빠르게 모으고 →
          <b> ② 구입자금은 정부 기금(디딤돌/신생아 특례, 최저금리)</b>으로 받고 →
          <b> ③ 부족분만 군인공제회 회원대출/민간으로 보완</b>하는 것이 일반적으로 가장 유리합니다.
          국가유공자·장기복무라면 <b>기관추천 특별공급</b>도 별도로 노려볼 수 있습니다.
        </p>
      </section>

      <p className="tiny-note">
        ⚠️ 이율·한도·자격은 제도 골격 설명용 참고값입니다. 실제 조건은
        <b> 군인공제회(mmaa.or.kr)</b> 및 각 기금·은행 고시를 확인하세요.
      </p>
    </div>
  )
}
