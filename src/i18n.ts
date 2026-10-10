export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'
export type T = (s: string, ...args: (string | number)[]) => string

/** Marks a string for translation where it is defined away from its t() call. */
export const N = (s: string) => s

/** Strings shared by every tool. App-specific ones are merged in from ./uk.ts. */
export const COMMON_UK: Record<string, string> = {
  'Source on GitHub': 'Код на GitHub',
  Language: 'Мова',
  Theme: 'Тема',
  System: 'Системна',
  Light: 'Світла',
  Dark: 'Темна',
  'Runs entirely in your browser. Your data never leaves it.': 'Працює повністю у браузері. Дані нікуди не надсилаються.',
  Export: 'Експорт',
  Import: 'Імпорт',
  Copy: 'Копіювати',
  Reset: 'Скинути',
  Clear: 'Очистити',
  Sample: 'Приклад',
}

let dict: Record<string, string> = COMMON_UK
export function registerUK(extra: Record<string, string>) {
  dict = { ...COMMON_UK, ...extra }
}

export function tr(lang: Lang, s: string, ...args: (string | number)[]): string {
  const src = lang === 'uk' ? (dict[s] ?? s) : s
  return src.replace(/\{(\d+)\}/g, (_, i: string) => String(args[+i]))
}
