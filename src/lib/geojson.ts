import type { GeoPoint } from './coords'

export interface FeatureCollection {
  type: 'FeatureCollection'
  features: { type: 'Feature'; geometry: { type: 'Point'; coordinates: [number, number] }; properties: Record<string, string | number> }[]
}

const asValue = (s: string): string | number => {
  const t = s.trim()
  return t !== '' && /^[+-]?\d+(\.\d+)?$/.test(t) && String(Number(t)) === t ? Number(t) : s
}

/** GeoJSON uses [longitude, latitude] order. Numeric-looking cells become numbers. */
export function toGeoJSON(headers: string[], rows: string[][], points: GeoPoint[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: Object.fromEntries(headers.map((h, i) => [h, asValue(rows[p.row][i] ?? '')])),
    })),
  }
}
