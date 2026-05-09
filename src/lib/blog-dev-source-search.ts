/** 博客页 URL search：`?source=1` 表示开发环境下进入 Markdown 源码编辑模式 */

export type BlogDevSourceSearch = {
  source?: 0 | 1
}

function normalizeSourceSearchParam(raw: Record<string, unknown>): 0 | 1 | undefined {
  const v = raw.source
  if (v === undefined || v === null) return undefined
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return undefined
    return v === 0 ? 0 : 1
  }
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase()
    if (t === '') return undefined
    if (t === '0' || t === 'false' || t === 'off') return 0
    if (t === '1' || t === 'true' || t === 'on') return 1
    const n = Number(t)
    if (Number.isFinite(n)) return n === 0 ? 0 : 1
    return undefined
  }
  if (Array.isArray(v) && v.length > 0) {
    return normalizeSourceSearchParam({ source: v[0] })
  }
  return undefined
}

export function validateBlogDevSourceSearch(raw: Record<string, unknown>): BlogDevSourceSearch {
  const source = normalizeSourceSearchParam(raw)
  if (source === undefined) return {}
  return { source }
}
