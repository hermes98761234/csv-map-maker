import { useEffect, useMemo, useRef, useState } from 'react'
import { MapView, type MapApi } from './MapView'
import { registerUK } from './i18n'
import { UK } from './uk'
import { parseCSV } from './lib/csv'
import { detectLatLon, extractPoints } from './lib/coords'
import { buildColorScale, buildSizeScale } from './lib/style'
import { toGeoJSON } from './lib/geojson'
import { SAMPLE_CSV } from './lib/sample'
import { downloadBlob, downloadText } from './lib/download'
import { Shell, useT, usePersisted } from './ui'

registerUK(UK)

interface Style { cluster: boolean; size: number; opacity: number }

export default function App() {
  const t = useT()
  const [text, setText] = useState(SAMPLE_CSV)
  const table = useMemo(() => parseCSV(text), [text])
  const auto = useMemo(() => detectLatLon(table), [table])
  const [latSel, setLat] = useState<number | null>(null)
  const [lonSel, setLon] = useState<number | null>(null)
  const [titleSel, setTitle] = useState<number | null>(null)
  const [colorCol, setColorCol] = useState<number | null>(null)
  const [sizeCol, setSizeCol] = useState<number | null>(null)
  const [style, setStyle] = usePersisted<Style>('style', { cluster: false, size: 7, opacity: 0.85 })
  const api = useRef<MapApi | null>(null)
  const file = useRef<HTMLInputElement>(null)

  // reset column choices whenever new data arrives
  useEffect(() => {
    setLat(null); setLon(null); setTitle(null)
    const h = table.headers
    const pref = ['name', 'title', 'city', 'label', 'id']
    const ti = h.findIndex((x) => pref.includes(x.toLowerCase()))
    setTitle(ti >= 0 ? ti : null)
    const cat = h.findIndex((x) => ['continent', 'category', 'type', 'group', 'class'].includes(x.toLowerCase()))
    setColorCol(cat >= 0 ? cat : null)
    const pop = h.findIndex((x) => /^(pop|size|count$|value|amount|mag)/i.test(x))
    setSizeCol(pop >= 0 ? pop : null)
  }, [table])

  const lat = latSel ?? auto?.lat ?? -1
  const lon = lonSel ?? auto?.lon ?? -1
  const { points, skipped } = useMemo(
    () => (lat >= 0 && lon >= 0 ? extractPoints(table, { lat, lon }) : { points: [], skipped: 0 }),
    [table, lat, lon],
  )

  const colorScale = useMemo(() => (colorCol === null ? null : buildColorScale(table.rows.map((r) => r[colorCol] ?? ''))), [table, colorCol])
  const sizeFn = useMemo(
    () => (sizeCol === null ? null : buildSizeScale(table.rows.map((r) => r[sizeCol] ?? ''), Math.max(2, style.size * 0.5), style.size * 2.4)),
    [table, sizeCol, style.size],
  )
  const color = useMemo(
    () => (row: number) => (colorScale && colorCol !== null ? colorScale.color(table.rows[row][colorCol] ?? '') : '#2563eb'),
    [colorScale, colorCol, table],
  )
  const radius = useMemo(
    () => (row: number) => (sizeFn && sizeCol !== null ? sizeFn(table.rows[row][sizeCol] ?? '') : style.size),
    [sizeFn, sizeCol, style.size, table],
  )

  const onFile = async (f: File | undefined) => {
    if (f) setText(await f.text())
  }
  const colSelect = (value: number | null, set: (v: number | null) => void, none: boolean, fallback?: number) => (
    <select value={value ?? (fallback !== undefined && fallback >= 0 ? fallback : -1)} onChange={(e) => set(+e.target.value < 0 ? null : +e.target.value)}>
      {none && <option value={-1}>{t('(none)')}</option>}
      {!none && fallback === -1 && <option value={-1}>—</option>}
      {table.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
    </select>
  )

  return (
    <Shell title={t('CSV Map Maker')}>
      <div className="body">
        <aside className="side">
          <div className="panel">
            <div className="section">
              <h3>{t('Data')}</h3>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files[0]) }}
              >
                <textarea rows={7} value={text} placeholder={t('Paste CSV here, or drop / choose a file')} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label={t('Data')} />
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <button onClick={() => file.current?.click()}>{t('Choose file')}</button>
                <button onClick={() => setText(SAMPLE_CSV)}>{t('Load sample')}</button>
                <button className="danger" onClick={() => setText('')}>{t('Clear')}</button>
                <input ref={file} type="file" accept=".csv,.tsv,.txt,text/csv" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
              </div>
              <p className="hint">{t('Rows')}: {table.rows.length} · {t('Delimiter: {0}', table.delimiter === '\t' ? 'TAB' : table.delimiter)}</p>
            </div>

            <div className="section">
              <h3>{t('Columns')}</h3>
              <div className="grid2">
                <div className="field"><label>{t('Latitude')}</label>{colSelect(latSel, setLat, false, auto?.lat ?? -1)}</div>
                <div className="field"><label>{t('Longitude')}</label>{colSelect(lonSel, setLon, false, auto?.lon ?? -1)}</div>
                <div className="field"><label>{t('Popup title')}</label>{colSelect(titleSel, setTitle, true)}</div>
                <div className="field"><label>{t('Colour by')}</label>{colSelect(colorCol, setColorCol, true)}</div>
                <div className="field"><label>{t('Size by')}</label>{colSelect(sizeCol, setSizeCol, true)}</div>
              </div>
              {auto && latSel === null && lonSel === null && <p className="hint ok-text">{t('Auto-detected')}: {table.headers[auto.lat]} / {table.headers[auto.lon]}</p>}
              {!auto && table.rows.length > 0 && latSel === null && <p className="hint err-text">{t('Could not find latitude / longitude columns. Pick them manually.')}</p>}
            </div>

            <div className="section">
              <h3>{t('Style')}</h3>
              <label className="check"><input type="checkbox" checked={style.cluster} onChange={(e) => setStyle({ ...style, cluster: e.target.checked })} />{t('Cluster nearby points')}</label>
              <div className="field"><label>{t('Marker size')}: {style.size}</label>
                <input type="range" min={3} max={14} value={style.size} onChange={(e) => setStyle({ ...style, size: +e.target.value })} /></div>
              <div className="field"><label>{t('Opacity')}: {style.opacity}</label>
                <input type="range" min={0.2} max={1} step={0.05} value={style.opacity} onChange={(e) => setStyle({ ...style, opacity: +e.target.value })} /></div>
            </div>

            <div className="section">
              <h3>{t('Export')}</h3>
              <div className="row">
                <button disabled={!points.length} onClick={() => downloadText('points.geojson', JSON.stringify(toGeoJSON(table.headers, table.rows, points), null, 2), 'application/geo+json')}>{t('Export GeoJSON')}</button>
                <button disabled={!points.length} onClick={() => void api.current?.exportPng().then((b) => downloadBlob('map.png', b))}>{t('Export PNG')}</button>
              </div>
            </div>
          </div>
        </aside>

        <main className="main">
          <div className="stats">
            <div className="stat"><b>{points.length}</b><span>{t('points on the map')}</span></div>
            {skipped > 0 && <div className="stat"><b className="warn-text">{skipped}</b><span>{t('rows skipped (bad coordinates)')}</span></div>}
          </div>
          <div className="mapwrap">
            <MapView
              headers={table.headers} rows={table.rows} points={points}
              color={color} radius={radius} cluster={style.cluster} titleCol={titleSel ?? -1} opacity={style.opacity}
              onApi={(a) => { api.current = a }}
            />
            {!points.length && <div className="scene-msg">{t('No data yet. Paste a CSV or load the sample.')}</div>}
            {colorScale && colorCol !== null && points.length > 0 && (
              <div className="legend">
                <b>{table.headers[colorCol]}</b>
                {colorScale.legend.map((l, i) => <div key={i}><i style={{ background: l.color }} />{l.label}</div>)}
              </div>
            )}
          </div>
        </main>
      </div>
    </Shell>
  )
}
