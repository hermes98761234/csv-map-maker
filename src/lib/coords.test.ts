import { describe, expect, it } from 'vitest'
import { detectLatLon, extractPoints, parseCoord } from './coords'
import { parseCSV, toCSV } from './csv'
import { toGeoJSON } from './geojson'
import { SAMPLE_CSV } from './sample'
import { buildColorScale, buildSizeScale, isNumericColumn, ramp } from './style'

describe('csv', () => {
  it('parses quotes, escaped quotes and embedded newlines', () => {
    const t = parseCSV('a,b\n"x,1","he said ""hi"""\n"l1\nl2",z\n')
    expect(t.headers).toEqual(['a', 'b'])
    expect(t.rows).toEqual([['x,1', 'he said "hi"'], ['l1\nl2', 'z']])
  })
  it('detects semicolon and tab delimiters', () => {
    expect(parseCSV('a;b;c\n1;2;3').delimiter).toBe(';')
    expect(parseCSV('a\tb\n1\t2').delimiter).toBe('\t')
  })
  it('round-trips through toCSV', () => {
    const t = parseCSV('a,b\n"x,1",2')
    expect(parseCSV(toCSV(t.headers, t.rows)).rows).toEqual(t.rows)
  })
  it('pads short rows and handles CRLF and BOM', () => {
    const t = parseCSV('\ufeffa,b,c\r\n1,2\r\n')
    expect(t.headers[0]).toBe('a')
    expect(t.rows[0]).toEqual(['1', '2', ''])
  })
})

describe('parseCoord', () => {
  it('parses decimals, comma decimals and hemisphere letters', () => {
    expect(parseCoord('50.45')).toBe(50.45)
    expect(parseCoord('-3,5')).toBe(-3.5)
    expect(parseCoord('12.5 S')).toBe(-12.5)
    expect(parseCoord('W 10')).toBe(-10)
  })
  it('parses DMS', () => {
    expect(parseCoord('50°27\'0" N')).toBeCloseTo(50.45, 6)
    expect(parseCoord('33°52\'7"S')).toBeCloseTo(-33.868611, 5)
    expect(parseCoord('-12 30 0')).toBeCloseTo(-12.5, 6)
  })
  it('rejects junk', () => {
    expect(parseCoord('abc')).toBeNull()
    expect(parseCoord('')).toBeNull()
  })
})

describe('detectLatLon', () => {
  it('finds by name', () => {
    const t = parseCSV(SAMPLE_CSV)
    expect(detectLatLon(t)).toEqual({ lat: 4, lon: 5 })
  })
  it('finds lng / latitude names', () => {
    expect(detectLatLon(parseCSV('id,Latitude,Lng\n1,2,3'))).toEqual({ lat: 1, lon: 2 })
  })
  it('falls back to ranges', () => {
    const t = parseCSV('name,a,b\nx,50.1,120.5\ny,10,170\nz,-20,-100')
    expect(detectLatLon(t)).toEqual({ lat: 1, lon: 2 })
  })
  it('returns null when nothing fits', () => {
    expect(detectLatLon(parseCSV('a,b\nfoo,bar'))).toBeNull()
  })
})

describe('extractPoints / geojson', () => {
  const t = parseCSV('n,lat,lon\na,10,20\nb,95,20\nc,x,1\nd,-5,-6')
  const { points, skipped } = extractPoints(t, { lat: 1, lon: 2 })
  it('skips invalid and out-of-range rows', () => {
    expect(points.map((p) => p.row)).toEqual([0, 3])
    expect(skipped).toBe(2)
  })
  it('writes lon,lat order and numeric properties', () => {
    const g = toGeoJSON(t.headers, t.rows, points)
    expect(g.features[0].geometry.coordinates).toEqual([20, 10])
    expect(g.features[1].properties).toEqual({ n: 'd', lat: -5, lon: -6 })
  })
})

describe('style', () => {
  it('detects numeric columns', () => {
    expect(isNumericColumn(['1', '2.5', '', '3'])).toBe(true)
    expect(isNumericColumn(['a', 'b', '1'])).toBe(false)
  })
  it('ramp endpoints are viridis ends', () => {
    expect(ramp(0)).toBe('rgb(68,1,84)')
    expect(ramp(1)).toBe('rgb(253,231,37)')
  })
  it('categorical scale gives most frequent the first colour', () => {
    const s = buildColorScale(['a', 'b', 'b', 'c', 'b'])
    expect(s.kind).toBe('categorical')
    expect(s.legend[0].label).toBe('b')
    expect(s.color('b')).toBe(s.legend[0].color)
  })
  it('numeric scale maps min and max', () => {
    const s = buildColorScale(['0', '5', '10'])
    expect(s.kind).toBe('numeric')
    expect(s.color('0')).toBe(ramp(0))
    expect(s.color('10')).toBe(ramp(1))
  })
  it('size scale is sqrt-scaled between bounds', () => {
    const f = buildSizeScale(['0', '100'], 4, 14)
    expect(f('0')).toBe(4)
    expect(f('100')).toBe(14)
    expect(f('25')).toBeCloseTo(9, 6)
  })
})
