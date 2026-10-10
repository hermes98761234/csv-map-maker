import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { tr, type Lang, type T, type Theme } from './i18n'

export interface Prefs { lang: Lang; theme: Theme }
const KEY = 'app-prefs:csv-map-maker'

function load(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>
    return {
      lang: p.lang === 'uk' || p.lang === 'en' ? p.lang : navigator.language?.toLowerCase().startsWith('uk') ? 'uk' : 'en',
      theme: p.theme === 'light' || p.theme === 'dark' ? p.theme : 'auto',
    }
  } catch {
    return { lang: 'en', theme: 'auto' }
  }
}

const Ctx = createContext<{ prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; t: T }>({
  prefs: { lang: 'en', theme: 'auto' },
  setPrefs: () => {},
  t: (s) => s,
})
export const useApp = () => useContext(Ctx)
export const useT = () => useContext(Ctx).t

export function Root({ children }: { children: ReactNode }) {
  const [prefs, setP] = useState<Prefs>(load)
  useEffect(() => {
    const root = document.documentElement
    if (prefs.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = prefs.theme
    root.lang = prefs.lang
    try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* private mode */ }
  }, [prefs])
  const t: T = (s, ...a) => tr(prefs.lang, s, ...a)
  return <Ctx.Provider value={{ prefs, setPrefs: (p) => setP((o) => ({ ...o, ...p })), t }}>{children}</Ctx.Provider>
}

/** Persisted state in localStorage (JSON). */
export function usePersisted<S>(key: string, init: S): [S, (v: S | ((o: S) => S)) => void] {
  const [v, setV] = useState<S>(() => {
    try {
      const raw = localStorage.getItem('csv-map-maker:' + key)
      return raw ? ({ ...init, ...JSON.parse(raw) } as S) : init
    } catch { return init }
  })
  useEffect(() => {
    try { localStorage.setItem('csv-map-maker:' + key, JSON.stringify(v)) } catch { /* ignore */ }
  }, [key, v])
  return [v, setV]
}

export function Shell({ title, children, toolbar }: { title: string; children: ReactNode; toolbar?: ReactNode }) {
  const { prefs, setPrefs, t } = useApp()
  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{title}</span>
        {toolbar}
        <span className="spacer" />
        <label className="inline">{t('Language')}
          <select value={prefs.lang} onChange={(e) => setPrefs({ lang: e.target.value as Lang })}>
            <option value="en">English</option>
            <option value="uk">Українська</option>
          </select>
        </label>
        <label className="inline">{t('Theme')}
          <select value={prefs.theme} onChange={(e) => setPrefs({ theme: e.target.value as Theme })}>
            <option value="auto">{t('System')}</option>
            <option value="light">{t('Light')}</option>
            <option value="dark">{t('Dark')}</option>
          </select>
        </label>
      </header>
      {children}
      <footer className="foot hint">
        {t('Runs entirely in your browser. Your data never leaves it.')} ·{' '}
        <a href="https://github.com/hermes98761234/csv-map-maker" target="_blank" rel="noreferrer">{t('Source on GitHub')}</a>
      </footer>
    </div>
  )
}
