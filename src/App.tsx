import { useState } from 'react'
import { CURRENT_POLICY } from './data/policy'
import { formatWon } from './lib/affordability'
import { hasConsent, setConsent } from './lib/profileStore'
import MatchTab from './tabs/MatchTab'
import BenefitsTab from './tabs/BenefitsTab'
import CalendarTab from './tabs/CalendarTab'
import MilitaryTab from './tabs/MilitaryTab'

type TabKey = 'match' | 'benefits' | 'calendar' | 'military'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'match', label: '내가 살 수 있는 집', icon: '🏠' },
  { key: 'benefits', label: '신혼·다자녀 혜택', icon: '💍' },
  { key: 'calendar', label: '청약 캘린더', icon: '📅' },
  { key: 'military', label: '군인공제 비교', icon: '🎖️' },
]

export default function App() {
  const [consent, setConsentState] = useState(hasConsent())
  const [tab, setTab] = useState<TabKey>('match')

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
        <div className="policy-pill" title={CURRENT_POLICY.note}>
          정책 기준일 {CURRENT_POLICY.effectiveDate} · DSR {Math.round(CURRENT_POLICY.dsrLimit * 100)}%
          {CURRENT_POLICY.loanHardCapWon ? ` · 한도 ${formatWon(CURRENT_POLICY.loanHardCapWon)}` : ''}
        </div>
      </header>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="tab-body">
        {tab === 'match' && <MatchTab />}
        {tab === 'benefits' && <BenefitsTab />}
        {tab === 'calendar' && <CalendarTab />}
        {tab === 'military' && <MilitaryTab />}
      </div>
    </div>
  )
}
