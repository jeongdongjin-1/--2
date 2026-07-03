// 평수(전용면적) 필터 밴드 — 한국 통용 평형 구간 기준
export type AreaBand = 'all' | 'xs' | 's' | 'm' | 'l' | 'xl'

export const AREA_BANDS: { key: AreaBand; label: string }[] = [
  { key: 'all', label: '전 평형' },
  { key: 'xs', label: '초소형 ~40㎡ (~15평형)' },
  { key: 's', label: '소형 40~59㎡ (구25평형)' },
  { key: 'm', label: '중형 60~84㎡ (구34평형)' },
  { key: 'l', label: '중대형 85~114㎡ (~45평형)' },
  { key: 'xl', label: '대형 115㎡~' },
]

export function matchArea(area: number, band: AreaBand): boolean {
  switch (band) {
    case 'all': return true
    case 'xs': return area < 40
    case 's': return area >= 40 && area < 60
    case 'm': return area >= 60 && area < 85
    case 'l': return area >= 85 && area < 115
    case 'xl': return area >= 115
  }
}
