import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import type { GeoPoint } from './lib/coords'
import { canvasToPng } from './lib/download'

export interface MapApi { exportPng: () => Promise<Blob> }

interface Props {
  headers: string[]
  rows: string[][]
  points: GeoPoint[]
  color: (row: number) => string
  radius: (row: number) => number
  cluster: boolean
  titleCol: number
  opacity: number
  onApi: (api: MapApi) => void
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function popupHtml(headers: string[], row: string[], titleCol: number): string {
  const title = titleCol >= 0 ? `<b>${esc(row[titleCol] ?? '')}</b>` : ''
  const body = headers.map((h, i) => `<tr><td style="color:#6b7280;padding-right:8px">${esc(h)}</td><td>${esc(row[i] ?? '')}</td></tr>`).join('')
  return `<div style="max-height:220px;overflow:auto">${title}<table style="font-size:12px;margin-top:4px">${body}</table></div>`
}

export function MapView({ headers, rows, points, color, radius, cluster, titleCol, opacity, onApi }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.Layer | null>(null)
  const fitted = useRef<GeoPoint[] | null>(null)
  const ptsRef = useRef({ points, color, radius, opacity })
  useEffect(() => { ptsRef.current = { points, color, radius, opacity } })

  useEffect(() => {
    const m = L.map(el.current!, { worldCopyJump: true, preferCanvas: true }).setView([30, 10], 2)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, crossOrigin: true,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m)
    map.current = m
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current!)
    onApi({
      exportPng: async () => {
        const box = el.current!
        const r0 = box.getBoundingClientRect()
        const draw = (withTiles: boolean) => {
          const c = document.createElement('canvas')
          c.width = Math.round(r0.width)
          c.height = Math.round(r0.height)
          const g = c.getContext('2d')!
          g.fillStyle = '#dbeafe'
          g.fillRect(0, 0, c.width, c.height)
          if (withTiles) {
            box.querySelectorAll<HTMLImageElement>('.leaflet-tile-pane img.leaflet-tile').forEach((img) => {
              if (!img.complete || !img.naturalWidth) return
              const r = img.getBoundingClientRect()
              g.drawImage(img, r.left - r0.left, r.top - r0.top, r.width, r.height)
            })
          }
          const { points, color, radius, opacity } = ptsRef.current
          g.globalAlpha = opacity
          for (const p of points) {
            const q = m.latLngToContainerPoint([p.lat, p.lon])
            if (q.x < -20 || q.y < -20 || q.x > c.width + 20 || q.y > c.height + 20) continue
            g.beginPath()
            g.arc(q.x, q.y, radius(p.row), 0, Math.PI * 2)
            g.fillStyle = color(p.row)
            g.fill()
            g.globalAlpha = 1
            g.strokeStyle = '#fff'
            g.lineWidth = 1.5
            g.stroke()
            g.globalAlpha = opacity
          }
          g.globalAlpha = 1
          g.font = '11px sans-serif'
          g.fillStyle = 'rgba(255,255,255,.8)'
          g.fillRect(c.width - 230, c.height - 16, 230, 16)
          g.fillStyle = '#333'
          g.fillText('© OpenStreetMap contributors', c.width - 224, c.height - 4)
          return c
        }
        try { return await canvasToPng(draw(true)) } catch { return await canvasToPng(draw(false)) }
      },
    })
    return () => { ro.disconnect(); m.remove(); map.current = null }
    // eslint-disable-next-line
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m) return
    if (layer.current) m.removeLayer(layer.current)
    const group: L.FeatureGroup = cluster ? L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 50 }) : L.featureGroup()
    const markers = points.map((p) => {
      const mk = L.circleMarker([p.lat, p.lon], {
        radius: radius(p.row), fillColor: color(p.row), fillOpacity: opacity, color: '#ffffff', weight: 1.5,
      })
      mk.bindPopup(() => popupHtml(headers, rows[p.row], titleCol), { maxWidth: 320 })
      return mk
    })
    if (cluster) (group as L.MarkerClusterGroup).addLayers(markers)
    else markers.forEach((mk) => group.addLayer(mk))
    group.addTo(m)
    layer.current = group
    if (fitted.current !== points && points.length) {
      fitted.current = points
      const b = L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number]))
      if (b.isValid()) m.fitBounds(b.pad(0.1), { maxZoom: 14, animate: false })
    }
  }, [headers, rows, points, color, radius, cluster, titleCol, opacity])

  return <div ref={el} className="map" role="application" aria-label="Map" />
}
