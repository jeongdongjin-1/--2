import { useEffect, useMemo, useState } from 'react'
import { BRIEFINGS, type BriefingCategory } from '../data/briefings'
import { CURRENT_POLICY } from '../data/policy'

const CATS: (BriefingCategory | '전체')[] = ['전체', '규제지역', '대출', '청약', '세제', '금리']

type NewsItem = { source: string; title: string; link: string; date: string; desc: string }

export default function BriefingTab() {
  const [cat, setCat] = useState<BriefingCategory | '전체'>('전체')
  const [news, setNews] = useState<NewsItem[]>([])
  const [newsState, setNewsState] = useState<'loading' | 'done' | 'empty'>('loading')
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)

  // 최신 소식 자동 수집 (국토부·금융위·정책브리핑 RSS, 서버 6시간 캐시)
  useEffect(() => {
    let alive = true
    fetch('/api/briefings')
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return
        const items: NewsItem[] = Array.isArray(j.news) ? j.news : []
        setNews(items)
        setFetchedAt(j.fetchedAt || null)
        setNewsState(items.length > 0 ? 'done' : 'empty')
      })
      .catch(() => alive && setNewsState('empty'))
    return () => {
      alive = false
    }
  }, [])

  const list = useMemo(() => {
    const sorted = [...BRIEFINGS].sort((a, b) => b.date.localeCompare(a.date))
    return cat === '전체' ? sorted : sorted.filter((b) => b.category === cat)
  }, [cat])

  return (
    <div className="tab-scroll briefing-tab">
      {/* 오늘 기준 핵심 요약 (현재 정책에서 파생) */}
      <section className="today-card">
        <div className="today-badge">오늘 기준 핵심 규제</div>
        <div className="today-grid">
          <div><span>규제지역 LTV</span><b>{Math.round(CURRENT_POLICY.ltv.regulated * 100)}%</b></div>
          <div><span>DSR 한도</span><b>{Math.round(CURRENT_POLICY.dsrLimit * 100)}%</b></div>
          <div><span>스트레스(규제)</span><b>+{(CURRENT_POLICY.stressRateRegulated * 100).toFixed(1)}%p</b></div>
          <div><span>주담대 한도</span><b>6/4/2억</b></div>
        </div>
        <p className="today-note">
          기준 시행일 {CURRENT_POLICY.effectiveDate} · 규제지역 서울 25구 + 경기 12곳. 새 대책이 나오면 아래 타임라인 맨 위에 반영됩니다.
        </p>
      </section>

      {/* 최신 소식 (자동 수집) */}
      <section className="news-section">
        <div className="news-head">
          <h3>📡 최신 소식 <span className="news-auto">자동 업데이트</span></h3>
          {fetchedAt && (
            <span className="news-time">
              {new Date(fetchedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })} 수집
            </span>
          )}
        </div>
        {newsState === 'loading' && <p className="tiny-note">국토부·금융위 보도자료를 불러오는 중…</p>}
        {newsState === 'empty' && (
          <p className="tiny-note">지금은 최신 소식을 가져오지 못했어요(피드 일시 오류). 아래 타임라인은 계속 유효합니다.</p>
        )}
        {newsState === 'done' && (
          <ul className="news-list">
            {news.slice(0, 10).map((n, i) => (
              <li key={i}>
                <a href={n.link} target="_blank" rel="noreferrer">
                  <span className={`news-src src-${n.source}`}>{n.source}</span>
                  <span className="news-title">{n.title}</span>
                  <time>{n.date}</time>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 카테고리 필터 */}
      <div className="brief-cats">
        {CATS.map((c) => (
          <button key={c} className={`brief-chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      {/* 타임라인 */}
      <div className="timeline">
        {list.map((b, i) => (
          <article key={i} className="brief-item">
            <div className="brief-line">
              <span className={`brief-tag cat-${b.category}`}>{b.category}</span>
              <time>{b.date}</time>
            </div>
            <h3>{b.title}</h3>
            <p className="brief-summary">{b.summary}</p>
            <div className="brief-impact">
              <b>💡 내 전략 영향</b> {b.impact}
            </div>
            <div className="brief-src">출처: {b.sources.join(', ')}</div>
          </article>
        ))}
        {list.length === 0 && <div className="empty">해당 카테고리의 브리핑이 없습니다.</div>}
      </div>

      <p className="tiny-note">
        ⓘ 큐레이션된 정책 요약입니다. 시행 세부·예외는 국토부·금융위 원문과 은행 안내를 확인하세요.
      </p>
    </div>
  )
}
