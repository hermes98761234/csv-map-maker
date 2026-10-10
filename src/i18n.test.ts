import { describe, expect, it } from 'vitest'
import { registerUK, tr } from './i18n'

describe('tr', () => {
  it('returns English unchanged and interpolates', () => {
    expect(tr('en', 'a {0} b {1}', 1, 'x')).toBe('a 1 b x')
  })
  it('translates known strings and falls back for unknown', () => {
    expect(tr('uk', 'Theme')).toBe('Тема')
    expect(tr('uk', 'Nope {0}', 2)).toBe('Nope 2')
    registerUK({ Foo: 'Фу' })
    expect(tr('uk', 'Foo')).toBe('Фу')
    expect(tr('uk', 'Theme')).toBe('Тема')
  })
})
