export const PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#78716c']

export type ColorKind = 'numeric' | 'categorical'

export interface ColorScale {
  kind: ColorKind
  color: (v: string) => string
  /** legend entries: categories, or [min, max] for numeric */
  legend: { label: string; color: string }[]
  min?: number
  max?: number
}

const num = (s: string) => {
  const t = s.trim().replace(',', '.')
  return t !== '' && /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t) ? Number(t) : NaN
}

/** True when most non-empty values are numbers. */
export function isNumericColumn(values: string[]): boolean {
  const nonEmpty = values.filter((v) => v.trim() !== '')
  if (!nonEmpty.length) return false
  return nonEmpty.filter((v) => !Number.isNaN(num(v))).length / nonEmpty.length > 0.9
}

/** Viridis-like ramp (5 stops) interpolated linearly in RGB. */
const RAMP: [number, number, number][] = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]]
export function ramp(t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (RAMP.length - 1)
  const i = Math.min(RAMP.length - 2, Math.floor(x))
  const f = x - i
  const c = RAMP[i].map((a, k) => Math.round(a + (RAMP[i + 1][k] - a) * f))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

export function buildColorScale(values: string[]): ColorScale {
  if (isNumericColumn(values)) {
    const nums = values.map(num).filter((v) => !Number.isNaN(v))
    const min = Math.min(...nums)
    const max = Math.max(...nums)
    const span = max - min || 1
    return {
      kind: 'numeric', min, max,
      color: (v) => { const x = num(v); return Number.isNaN(x) ? '#9ca3af' : ramp((x - min) / span) },
      legend: [0, 0.25, 0.5, 0.75, 1].map((t) => ({ label: fmt(min + span * t), color: ramp(t) })),
    }
  }
  // categorical: most frequent first
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  const cats = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k)
  const map = new Map(cats.map((c, i) => [c, i < PALETTE.length - 1 ? PALETTE[i] : '#78716c']))
  return {
    kind: 'categorical',
    color: (v) => map.get(v) ?? '#78716c',
    legend: cats.slice(0, 12).map((c) => ({ label: c === '' ? '(empty)' : c, color: map.get(c)! })),
  }
}

export function fmt(x: number): string {
  const a = Math.abs(x)
  return a >= 1000 || Number.isInteger(x) ? String(Math.round(x * 100) / 100) : a >= 1 ? x.toFixed(2) : x.toPrecision(3)
}

/** Radius in px for a value scaled sqrt (area ∝ value) between minR and maxR. */
export function buildSizeScale(values: string[], minR = 4, maxR = 18): (v: string) => number {
  const nums = values.map(num).filter((v) => !Number.isNaN(v))
  if (!nums.length) return () => minR
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  return (v) => {
    const x = num(v)
    if (Number.isNaN(x)) return minR
    return minR + Math.sqrt((x - min) / span) * (maxR - minR)
  }
}
