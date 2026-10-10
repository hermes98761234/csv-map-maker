import type { Table } from './csv'

/** Parse a coordinate: decimal ("50.45", "50,45"), hemisphere letter ("50.45 N"), or DMS ("50°27'0\" N"). */
export function parseCoord(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null
  let sign = 1
  const hem = /([NSEWnsew])\s*$|^\s*([NSEWnsew])(?=[\s\d-])/.exec(s)
  if (hem) {
    const h = (hem[1] ?? hem[2]).toUpperCase()
    if (h === 'S' || h === 'W') sign = -1
    s = s.replace(hem[0], '').trim()
  }
  if (/^[+-]?\d+(\.\d+)?$/.test(s) || /^[+-]?\d*,\d+$/.test(s)) {
    const v = Number(s.replace(',', '.'))
    return Number.isFinite(v) ? v * sign : null
  }
  const m = /^([+-]?)\s*(\d+(?:[.,]\d+)?)\s*[°d:\s]\s*(?:(\d+(?:[.,]\d+)?)\s*['′m:\s]\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:["″s]|'')?\s*)?$/.exec(s)
  if (!m) return null
  const n = (x: string | undefined) => (x ? Number(x.replace(',', '.')) : 0)
  const v = n(m[2]) + n(m[3]) / 60 + n(m[4]) / 3600
  return (m[1] === '-' ? -1 : 1) * sign * v
}

const LAT_NAMES = ['lat', 'latitude', 'latitud', 'lat_deg', 'ylat', 'y', 'широта', 'breitengrad']
const LON_NAMES = ['lon', 'lng', 'long', 'longitude', 'longitud', 'lon_deg', 'xlon', 'x', 'довгота', 'laengengrad', 'längengrad']

const norm = (h: string) => h.trim().toLowerCase().replace(/[\s.-]+/g, '_')

export interface LatLonCols { lat: number; lon: number }

/** Guess latitude and longitude columns from names, falling back to value ranges. */
export function detectLatLon(t: Pick<Table, 'headers' | 'rows'>): LatLonCols | null {
  const h = t.headers.map(norm)
  const find = (names: string[]) => {
    for (const n of names) {
      const i = h.indexOf(n)
      if (i >= 0) return i
    }
    for (let i = 0; i < h.length; i++) if (names.slice(0, 3).some((n) => n.length > 2 && h[i].includes(n))) return i
    return -1
  }
  const lat = find(LAT_NAMES)
  const lon = find(LON_NAMES)
  if (lat >= 0 && lon >= 0 && lat !== lon) return { lat, lon }
  // fallback: numeric columns with plausible ranges, adjacent pair preferred
  const sample = t.rows.slice(0, 200)
  const stats = t.headers.map((_, c) => {
    let ok = 0, inLat = 0, inLon = 0
    for (const r of sample) {
      const v = parseCoord(r[c] ?? '')
      if (v === null) continue
      ok++
      if (Math.abs(v) <= 90) inLat++
      if (Math.abs(v) <= 180) inLon++
    }
    const n = sample.length || 1
    return { numeric: ok / n > 0.9, lat: inLat / n > 0.9, lon: inLon / n > 0.9 }
  })
  for (let c = 0; c < stats.length - 1; c++) {
    if (stats[c].numeric && stats[c + 1].numeric && stats[c].lat && stats[c + 1].lon) return { lat: c, lon: c + 1 }
  }
  return null
}

export interface GeoPoint { lat: number; lon: number; row: number }

export function extractPoints(t: Pick<Table, 'rows'>, cols: LatLonCols): { points: GeoPoint[]; skipped: number } {
  const points: GeoPoint[] = []
  let skipped = 0
  t.rows.forEach((r, i) => {
    const lat = parseCoord(r[cols.lat] ?? '')
    const lon = parseCoord(r[cols.lon] ?? '')
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) skipped++
    else points.push({ lat, lon, row: i })
  })
  return { points, skipped }
}
