export interface Table { headers: string[]; rows: string[][]; delimiter: string }

/** Pick the delimiter that yields the most consistent column count on the first lines. */
export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10)
  let best = ','
  let bestScore = -1
  for (const d of [',', ';', '\t', '|']) {
    const counts = lines.map((l) => splitLine(l, d).length)
    const first = counts[0] ?? 1
    if (first < 2) continue
    const consistent = counts.filter((c) => c === first).length
    const score = consistent * 100 + first
    if (score > bestScore) { bestScore = score; best = d }
  }
  return best
}

function splitLine(line: string, d: string): string[] {
  return parseCSVRaw(line, d)[0] ?? ['']
}

/** RFC-4180-ish parser: quotes, escaped quotes, newlines inside quotes. */
export function parseCSVRaw(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQ = false
  let i = 0
  if (text.charCodeAt(0) === 0xfeff) i = 1
  for (; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false
      } else field += c
    } else if (c === '"' && field === '') inQ = true
    else if (c === delimiter) { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

export function parseCSV(text: string, delimiter?: string): Table {
  const d = delimiter ?? detectDelimiter(text)
  const all = parseCSVRaw(text, d).filter((r) => r.some((c) => c.trim() !== ''))
  if (!all.length) return { headers: [], rows: [], delimiter: d }
  const headers = all[0].map((h, i) => h.trim() || `column${i + 1}`)
  const rows = all.slice(1).map((r) => headers.map((_, i) => r[i] ?? ''))
  return { headers, rows, delimiter: d }
}

export function toCSV(headers: string[], rows: string[][], delimiter = ','): string {
  const q = (s: string) => (s.includes(delimiter) || /["\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s)
  return [headers, ...rows].map((r) => r.map(q).join(delimiter)).join('\n')
}
