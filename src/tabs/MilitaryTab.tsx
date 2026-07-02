import { useEffect, useState } from 'react'
import { MILITARY_BENEFITS, MILITARY_COMPARE } from '../data/military'

type MilSub = {
  date: string
  title: string
  region: string
  address?: string
  url?: string
  winnerDate?: string
  insttCount: number
}

// 기관추천(군 등) 물량 있는 다가오는 청약 일정
function MilitarySchedule() {
  const [items, setItems] = useState<MilSub[]>([])
  const [state, setState] = useState<'loading' | 'done' | 'empty'>('loading')

  useEffect(() => {
    let alive = true
    fetch('/api/military-subscriptions')
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return
        const list: MilSub[] = Array.isArray(j.items) ? j.items : []
        setItems(list)
        setState(list.length > 0 ? 'done' : 'empty')
      })
      .catch(() => alive && setState('empty'))
    return () => {
      alive = false
    }
  }, [])

  return (
    <section className="panel mil-schedule">
      <h3>📅 기관추천 물량 있는 청약 일정 <span className="news-auto">자동 업데이트</span></h3>
      <p className="mil-sched-note">
        장기복무 군인·국가유공자 등은 <b>기관추천 특별공급</b> 대상이 될 수 있습니다(소속 기관 추천 필요).
        아래는 접수 임박 분양 중 기관추천 물량이 확인된 단지입니다.
      </p>
      {state === 'loading' && <p className="tiny-note">청약홈에서 기관추천 물량을 조회하는 중… (최초 조회는 수 초 걸려요)</p>}
      {state === 'empty' && (
        <p className="tiny-note">
          지금 접수 예정 분양 중 기관추천 물량이 확인되는 단지가 없어요(또는 청약홈 키 미설정). 새 공고가 나오면 자동으로 표시됩니다.
        </p>
      )}
      {state === 'done' && (
        <ul className="mil-sub-list">
          {items.map((e, i) => (
            <li key={i}>
              <div className="mil-sub-top">
                <span className="mil-date">{e.date.slice(5).replace('-', '.')} 접수</span>
                <b>{e.title}</b>
                <span className="mil-count">기관추천 {e.insttCount}세대</span>
              </div>
              <div className="mil-sub-meta">
                {e.address || e.region}
                {e.winnerDate ? ` · 발표 ${e.winnerDate.slice(5).replace('-', '.')}` : ''}
              </div>
              {e.url && (
                <a className="ev-link" href={e.url} target="_blank" rel="noreferrer">청약홈 공고 보기 ↗</a>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="tiny-note">
        군인공제회 자체 분양(회원 대상)은{' '}
        <a href="https://www.mmaa.or.kr" target="_blank" rel="noreferrer">군인공제회(mmaa.or.kr)</a> 공고를 확인하세요.
        기관추천 신청 절차는 소속 군(국방부·각 군 본부) 추천 공문이 필요합니다.
      </p>
    </section>
  )
}

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

      <MilitarySchedule />

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
