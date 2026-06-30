// 개인정보(재무 프로필) 로컬 저장소.
// v1 정책: 개인정보는 사용자의 PC(localStorage)에만 저장하고 서버로 전송하지 않는다.
// 동의 플래그를 함께 보관하여, 동의 전에는 입력값을 저장하지 않는다.
import type { UserProfile } from './affordability'

const KEY = 'budongsan.profile.v1'
const CONSENT_KEY = 'budongsan.consent.v1'

export const DEFAULT_PROFILE: UserProfile = {
  annualIncomeWon: 60_000_000,
  cashAssetsWon: 200_000_000,
  existingAnnualDebtPaymentWon: 0,
  isFirstTime: true,
  ownedHouses: 0,
}

export function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PROFILE
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PROFILE
  }
}

export function saveProfile(p: UserProfile) {
  if (!hasConsent()) return
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function clearProfile() {
  localStorage.removeItem(KEY)
}

export function hasConsent(): boolean {
  return localStorage.getItem(CONSENT_KEY) === 'yes'
}

export function setConsent(v: boolean) {
  localStorage.setItem(CONSENT_KEY, v ? 'yes' : 'no')
  if (!v) clearProfile()
}
