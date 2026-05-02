import { defaultSchema } from 'hast-util-sanitize'

const schemaAttrs = defaultSchema.attributes as Record<string, unknown[]> | undefined

/**
 * Streamdown 内置 rehype-sanitize；默认 schema 里多数标签不允许任意 `className`，
 * 内联 HTML 上的 `class` 会被剥掉。此处与 hast 默认 schema 合并，为常用标签补上 `className`。
 */
export const streamdownMarkdownAllowedTags: Record<string, string[]> = (() => {
  const tagNames = defaultSchema.tagNames ?? []
  const tags = [
    'span',
    'p',
    'div',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'section',
    'article',
    'blockquote',
    'strong',
    'em',
    'b',
    'i',
    's',
    'kbd',
    'samp',
    'sub',
    'sup',
    'q',
    'pre',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'td',
    'th',
    'details',
    'summary',
    'img',
    'a',
    'del',
    'ins',
    'ul',
    'ol',
    'li',
    'ruby',
    'rp',
    'rt',
    'picture',
    'source',
  ] as const

  const allowClassName = (tag: string): string[] => {
    const base =
      schemaAttrs && Object.prototype.hasOwnProperty.call(schemaAttrs, tag)
        ? [...(schemaAttrs[tag] ?? [])]
        : []
    if (!base.includes('className')) {
      base.push('className')
    }
    return base as string[]
  }

  const out: Record<string, string[]> = {}
  for (const tag of tags) {
    if (tagNames.includes(tag)) {
      out[tag] = allowClassName(tag)
    }
  }
  return out
})()
