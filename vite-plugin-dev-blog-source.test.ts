import { describe, expect, it } from 'vitest'
import { normalizeRelativeUnderContent } from './vite-plugin-dev-blog-source'

describe('normalizeRelativeUnderContent', () => {
  it('returns empty string for root-like inputs', () => {
    expect(normalizeRelativeUnderContent('')).toBe('')
    expect(normalizeRelativeUnderContent('///')).toBe('')
  })

  it('normalizes slashes and segments', () => {
    expect(normalizeRelativeUnderContent('blog/santi/volume 2')).toBe('blog/santi/volume 2')
    expect(normalizeRelativeUnderContent('/blog/foo.md')).toBe('blog/foo.md')
  })

  it('rejects path traversal and dots', () => {
    expect(normalizeRelativeUnderContent('../x')).toBeNull()
    expect(normalizeRelativeUnderContent('a/../b')).toBeNull()
    expect(normalizeRelativeUnderContent('a/./b')).toBeNull()
    expect(normalizeRelativeUnderContent('a\0b')).toBeNull()
  })
})
