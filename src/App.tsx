import { useEffect, useState } from 'react'
import { loadSeen } from './lib/seenSubs'
import { CURRENT_POLICY } from './data/policy'
import { formatWon } from './lib/affordability'
import { hasConsent, setConsent } from './lib/profileStore'
import MatchTab from './tabs/MatchTab'
import MapTab from './tabs/MapTab'
import StrategyTab from './tabs/StrategyTab'
import BriefingTab from './tabs/BriefingTab'
import BenefitsTab from './tabs/BenefitsTab'
import CalendarTab from './tabs/CalendarTab'
import MilitaryTab from './tabs/MilitaryTab'

type TabKey = 'match' | 'map' | 'strategy' | 'briefing' | 'benefits' | 'calendar' | 'military'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'match', label: '내가 살 수 있는 집', icon: '🏠' },
  { key: 'map', label: '지도', icon: '🗺️' },
  { key: 'strategy', label: '청약·매매 전략', icon: '⚖️' },
  { key: 'briefing', label: '정책 브리핑', icon: '📰' },
  { key: 'benefits', label: '신혼·다자녀 혜택', icon: '💍' },
  { key: 'calendar', label: '청약 캘린더', icon: '📅' },
  { key: 'military', label: '군인공제 비교', icon: '🎖️' },
]

export default function App() {
  const [consent, setConsentState] = useState(hasConsent())
  const [tab, setTab] = useState<TabKey>('match')
  const [newSubCount, setNewSubCount] = useState(0)

  // 새 청약 공고 알림 — 마지막 방문 이후 새로 뜬 특별공급 공고 수 (캘린더 열면 해제)
  useEffect(() => {
    if (!consent) return
    let alive = true
    fetch('/api/subscriptions')
      .then((r) => r.json())
      .then((j) => {
        if (!alive || j.source !== 'applyhome') return
        const seen = loadSeen()
        const hmNos = new Set<string>(
          (j.items || []).filter((e: any) => e.type === 'special' && e.hmNo).map((e: any) => String(e.hmNo))
        )
        setNewSubCount([...hmNos].filter((h) => !seen.has(h)).length)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [consent])

  useEffect(() => {
    if (tab === 'calendar') setNewSubCount(0) // CalendarTab이 markSeen 처리
  }, [tab])

  if (!consent) {
    return (
      <div className="consent-gate">
        <div className="consent-card">
          <h1>🏠 집찾기</h1>
          <p className="lead">수도권 아파트 실거래가 + 내가 살 수 있는 집 매칭</p>
          <div className="consent-box">
            <h3>개인정보 이용 동의</h3>
            <ul>
              <li>소득·자산·부채 등 입력값은 <b>이 PC(브라우저)에만 저장</b>됩니다.</li>
              <li>입력한 개인정보는 <b>외부 서버로 전송되지 않습니다.</b></li>
              <li>대출한도 계산은 모두 브라우저 내에서 수행됩니다.</li>
              <li>실거래가 조회 시에는 지역코드·거래월만 서버로 전달됩니다.</li>
            </ul>
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              setConsent(true)
              setConsentState(true)
            }}
          >
            동의하고 시작하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🏠 집찾기 <span>· 수도권 아파트</span></div>
        <div className="topbar-right">
          <span className="date-chip" title="실거래·청약·브리핑은 접속 시 최신 데이터로 갱신됩니다">
            {new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} 기준
          </span>
          <div className="policy-pill" title={`${CURRENT_POLICY.note}\n출처: ${CURRENT_POLICY.sources.join(', ')}`}>
            정책 {CURRENT_POLICY.effectiveDate} · DSR {Math.round(CURRENT_POLICY.dsrLimit * 100)}% · 규제 LTV{' '}
            {Math.round(CURRENT_POLICY.ltv.regulated * 100)}% · 한도 6/4/2억
          </div>
        </div>
      </header>

      <nav className="tabbar" role="tablist" aria-label="주요 기능 탭">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            aria-current={tab === t.key ? 'page' : undefined}
            className={`tab ${tab === t.key ? 'on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span className="tab-icon" aria-hidden="true">{t.icon}</span>
            {t.label}
            {t.key === 'calendar' && newSubCount > 0 && (
              <span className="tab-badge" aria-label={`새 청약 공고 ${newSubCount}건`}>{newSubCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="tab-body">
        {tab === 'match' && <MatchTab />}
        {tab === 'map' && <MapTab />}
        {tab === 'strategy' && <StrategyTab />}
        {tab === 'briefing' && <BriefingTab />}
        {tab === 'benefits' && <BenefitsTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'military' && <MilitaryTab />}
      </div>
    </div>
  )
}
