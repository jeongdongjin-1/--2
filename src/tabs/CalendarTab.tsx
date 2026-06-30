import { useEffect, useMemo, useState } from 'react'
import {
  SPECIAL_SUPPLY,
  SUBSCRIPTION_EVENTS,
  type SubscriptionEvent,
} from '../data/subscription'
import { formatWon } from '../lib/affordability'

type Model = { ty: string; exclusiveArea: number; pyeong: number; supplyArea: number; hshld: number; priceWon: number }

// 평형별 분양가 + 실제 특별공급 유형 (선택 시 지연 로드)
function PriceModels({ hmNo }: { hmNo?: string }) {
  const [data, setData] = useState<{ models: Model[]; specialTypes: string[] } | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')

  useEffect(() => {
    if (!hmNo) return
    setState('loading')
    fetch(`/api/subscription-models?hmNo=${encodeURIComponent(hmNo)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) { setState('error'); return }
        setData({ models: j.models || [], specialTypes: j.specialTypes || [] })
        setState('done')
      })
      .catch(() => setState('error'))
  }, [hmNo])

  if (!hmNo) return null
  if (state === 'loading') return <div className="pm-load">평형별 분양가 불러오는 중…</div>
  if (state === 'error' || !data) return null
  if (data.models.length === 0 && data.specialTypes.length === 0) return null

  return (
    <div className="price-models">
      {data.specialTypes.length > 0 && (
        <div className="ev-hh">
          {data.specialTypes.map((t) => <span key={t} className="hh-tag">{t}</span>)}
        </div>
      )}
      {data.models.length > 0 && (
        <table className="pm-table">
          <thead>
            <tr><th>주택형</th><th>전용</th><th>세대</th><th>분양가</th></tr>
          </thead>
          <tbody>
            {data.models.map((m, i) => (
              <tr key={i}>
                <td>{m.ty}</td>
                <td>{m.exclusiveArea}㎡<span className="py">·{m.pyeong}평</span></td>
                <td>{m.hshld}</td>
                <td className="pm-price">{formatWon(m.priceWon)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const TYPE_LABEL: Record<SubscriptionEvent['type'], string> = {
  special: '특별공급',
  first: '1순위',
  second: '2순위',
}

function ymKey(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

export default function CalendarTab() {
  const [events, setEvents] = useState<SubscriptionEvent[]>(SUBSCRIPTION_EVENTS)
  const [source, setSource] = useState<string>('')

  // 청약홈 API에서 일정 로드 (실패/키없음 → 정적 샘플 유지)
  useEffect(() => {
    let alive = true
    fetch('/api/subscriptions')
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return
        setSource(json.source || '')
        if (Array.isArray(json.items) && json.items.length > 0) setEvents(json.items)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // 첫 이벤트가 있는 달을 기본으로
  const firstEvent = events[0]?.date ?? '2026-07-01'
  const [year, setYear] = useState(Number(firstEvent.slice(0, 4)))
  const [month, setMonth] = useState(Number(firstEvent.slice(5, 7)) - 1) // 0-based
  const [selected, setSelected] = useState<string | null>(null)

  const eventsByDate = useMemo(() => {
    const map = new Map<string, SubscriptionEvent[]>()
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, [])
      map.get(e.date)!.push(e)
    }
    return map
  }, [events])

  // 데이터 로드 후 첫 이벤트 달/날짜로 이동
  useEffect(() => {
    if (events.length === 0) return
    const d = events[0].date
    setYear(Number(d.slice(0, 4)))
    setMonth(Number(d.slice(5, 7)) - 1)
    setSelected(d)
  }, [events])

  const monthHasEvents = useMemo(
    () => events.filter((e) => e.date.startsWith(ymKey(year, month))),
    [events, year, month]
  )

  // 달력 칸 구성
  const firstDay = new Date(year, month, 1).getDay() // 0=일
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function shift(delta: number) {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth(m)
    setYear(y)
    setSelected(null)
  }

  const selectedEvents = selected ? eventsByDate.get(selected) ?? [] : []

  return (
    <div className="tab-scroll calendar-tab">
      <div className="cal-layout">
        <section className="panel cal-panel">
          <div className="cal-head">
            <button className="nav-btn" onClick={() => shift(-1)}>‹</button>
            <h2>{year}년 {month + 1}월 청약 일정</h2>
            <button className="nav-btn" onClick={() => shift(1)}>›</button>
          </div>

          <div className="cal-grid cal-dow">
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <div key={d} className={`dow ${i === 0 ? 'sun' : ''} ${i === 6 ? 'sat' : ''}`}>{d}</div>
            ))}
          </div>
          <div className="cal-grid">
            {cells.map((d, i) => {
              if (d == null) return <div key={i} className="cal-cell empty-cell" />
              const dateStr = `${ymKey(year, month)}-${String(d).padStart(2, '0')}`
              const evs = eventsByDate.get(dateStr) ?? []
              const dow = (firstDay + d - 1) % 7
              return (
                <div
                  key={i}
                  className={`cal-cell ${evs.length ? 'has-ev' : ''} ${selected === dateStr ? 'sel' : ''}`}
                  onClick={() => evs.length && setSelected(dateStr)}
                >
                  <div className={`cal-date ${dow === 0 ? 'sun' : ''} ${dow === 6 ? 'sat' : ''}`}>{d}</div>
                  {evs.slice(0, 2).map((e, j) => (
                    <div key={j} className={`ev-chip ${e.type}`}>{e.title.replace(/\s*\(샘플\)/, '')}</div>
                  ))}
                  {evs.length > 2 && <div className="ev-more">+{evs.length - 2}</div>}
                </div>
              )
            })}
          </div>

          {monthHasEvents.length === 0 && (
            <p className="tiny-note center">이 달에는 등록된 일정이 없습니다. ‹ › 로 이동해보세요.</p>
          )}
        </section>

        <aside className="cal-side">
          <section className="panel">
            <h3>{selected ? `${selected} 일정` : '날짜를 선택하세요'}</h3>
            {selectedEvents.length === 0 && <p className="tiny-note">선택한 날짜의 청약 일정이 여기에 표시됩니다.</p>}
            {selectedEvents.map((e, i) => (
              <div key={i} className="ev-detail">
                <div className="ev-detail-top">
                  <span className={`type-tag ${e.type}`}>{TYPE_LABEL[e.type]}</span>
                  <b>{e.title.replace(/\s*\(샘플\)/, '')}</b>
                </div>
                <div className="ev-region">{e.region}{e.priceNote ? ` · ${e.priceNote}` : ''}</div>
                {e.address && <div className="ev-addr">📍 {e.address}</div>}
                {e.winnerDate && <div className="ev-addr">🏆 당첨자발표 {e.winnerDate}</div>}
                {/* 평형별 분양가 + 실제 특별공급 유형 (hmNo 있으면 지연 로드) */}
                {e.hmNo ? (
                  <PriceModels hmNo={e.hmNo} />
                ) : (
                  e.households.length > 0 && (
                    <div className="ev-hh">
                      {e.households.map((h) => <span key={h} className="hh-tag">{h}</span>)}
                    </div>
                  )
                )}
                {e.url && (
                  <a className="ev-link" href={e.url} target="_blank" rel="noreferrer">
                    청약홈 공고 보기 ↗
                  </a>
                )}
              </div>
            ))}
          </section>

          <section className="panel">
            <h3>특별공급 유형</h3>
            <div className="ss-list">
              {SPECIAL_SUPPLY.map((s) => (
                <details key={s.key} className="ss-item">
                  <summary>
                    <b>{s.name}</b>
                    <span className="ss-ratio">{s.ratio}</span>
                  </summary>
                  <div className="ss-for">{s.forHouseholds.map((f) => <span key={f} className="hh-tag sm">{f}</span>)}</div>
                  <p>{s.note}</p>
                </details>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {source === 'applyhome' ? (
        <p className="tiny-note">✅ 한국부동산원 청약홈 공공 API 실시간 분양 일정 (수도권 APT)</p>
      ) : (
        <p className="tiny-note">
          ⚠️ 표시된 일정은 <b>샘플</b>입니다(청약홈 API 키 미설정). 실제 분양·청약 일정은
          <b> 청약홈(applyhome.co.kr)</b> 또는 한국부동산원 청약홈 공공 API로 자동 연동됩니다.
        </p>
      )}
    </div>
  )
}
