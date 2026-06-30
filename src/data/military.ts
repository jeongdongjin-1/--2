// ──────────────────────────────────────────────────────────────────────────
// 군인공제회 등 직역(특수직역) 주택 혜택 vs 민간 비교 (참고용 · 갱신 대상)
//
// 군인공제회(대한민국군인공제회)는 직업군인 회원 대상 저축/대출/주택 사업을 운영한다.
// 아래 수치·조건은 제도 골격 설명용 대략값으로, 실제 이율/한도는 군인공제회
// (mmaa.or.kr) 및 각 기금 고시를 확인해 갱신할 것.
// ──────────────────────────────────────────────────────────────────────────

export type CompareRow = {
  aspect: string // 비교 항목
  military: string // 군인공제회/직역
  govFund: string // 정부 지원 대출(주택도시기금)
  privateBank: string // 민간 시중은행
  edge: 'military' | 'govFund' | 'privateBank' | 'mixed' // 가장 유리한 쪽
}

export const MILITARY_COMPARE: CompareRow[] = [
  {
    aspect: '대상',
    military: '군인공제회 회원(직업군인) — 가입·납입 회원',
    govFund: '무주택 서민·신혼·다자녀 등 소득요건 충족자',
    privateBank: '제한 없음(신용·담보 심사)',
    edge: 'mixed',
  },
  {
    aspect: '주택구입 자금 대출 금리',
    military: '회원 대출 연 4%대 (회원 우대, 신용기반)',
    govFund: '디딤돌 2.4~3.5% / 신생아 특례 1.6~3.3% (가장 낮음)',
    privateBank: '주담대 변동 4~6%대 (시장금리 연동)',
    edge: 'govFund',
  },
  {
    aspect: '목돈 저축(공제) 이율',
    military: '군인공제회 적립 — 시중 예금 대비 높은 복리(회원 한정)',
    govFund: '해당 없음(대출 중심)',
    privateBank: '일반 예적금 시장금리',
    edge: 'military',
  },
  {
    aspect: '한도',
    military: '회원 납입·신용 기반 한도(상품별 상이)',
    govFund: '구입 최대 4~5억 / 전세 최대 3억',
    privateBank: 'LTV·DSR 한도 내 최대',
    edge: 'mixed',
  },
  {
    aspect: '소득·주택가 요건',
    military: '대체로 완화(회원 자격 중심)',
    govFund: '엄격(소득·자산·주택가 상한 있음)',
    privateBank: 'DSR 규제 외 별도 요건 없음',
    edge: 'military',
  },
  {
    aspect: '주거 지원',
    military: '관사·군 영외 숙소, 분양/임대 연계 사업',
    govFund: '공공분양·임대 연계',
    privateBank: '없음',
    edge: 'mixed',
  },
  {
    aspect: '특별공급 청약',
    military: '기관추천 특별공급(국가유공자/군 관련) 대상 가능',
    govFund: '신혼·다자녀·생애최초 등 일반 특공',
    privateBank: '해당 없음',
    edge: 'military',
  },
]

export type MilitaryBenefit = {
  title: string
  desc: string
  basis: string
}

export const MILITARY_BENEFITS: MilitaryBenefit[] = [
  {
    title: '회원 주택자금 대출',
    desc: '회원 자격·납입 실적 기반으로 구입/전세 자금을 회원 우대금리로 대출. 민간 신용대출보다 유리한 경우가 많음.',
    basis: '대한민국군인공제회 회원대출',
  },
  {
    title: '목돈수탁·저축(복리)',
    desc: '회원이 적립하면 시중 예금보다 높은 복리 이율로 운용 — 자기자본(자기자금) 마련 가속에 유리.',
    basis: '군인공제회 목돈수탁급여',
  },
  {
    title: '기관추천 특별공급',
    desc: '국가유공자·장기복무 제대군인 등은 청약 기관추천 특별공급 물량 대상이 될 수 있음(별도 가점 경쟁 없이 배정 물량).',
    basis: '주택공급규칙 기관추천 특별공급',
  },
  {
    title: '정부 지원 대출과 병행',
    desc: '군인공제회 혜택은 정부 기금 대출(디딤돌/신생아 특례)과 별개. 보통 금리는 기금이 가장 낮으므로 "기금 대출 + 공제회 저축으로 자기자본"이 유리한 조합.',
    basis: '주택도시기금 + 공제회 병행 전략',
  },
]
