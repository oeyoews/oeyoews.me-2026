import { defaultRehypePlugins } from 'streamdown'
import { rehypeGithubAlerts } from 'rehype-github-alerts'
import type { Schema } from 'hast-util-sanitize'
import type { PluggableList } from 'unified'
import { streamdownMarkdownAllowedTags } from '@/lib/streamdown-markdown-allowed-tags'

/** Octicons in `rehype-github-alerts` v4；GitHub 默认 sanitize 不含 svg/path，需显式放行 */
const rehypeGithubAlertsSvgTags: Record<string, string[]> = {
  svg: [
    'className',
    'viewBox',
    'width',
    'height',
    'version',
    'xmlns',
    'ariaHidden',
    'role',
    'fill',
    'stroke',
    'focusable',
  ],
  path: ['className', 'd', 'fill', 'stroke', 'opacity', 'fillRule', 'clipRule'],
}

function mergeSanitizeSchemaLikeStreamdown(): Schema {
  const sanitize = defaultRehypePlugins.sanitize
  if (!Array.isArray(sanitize)) {
    throw new Error('streamdown: default sanitize plugin must be a tuple')
  }
  const [, ze] = sanitize as [unknown, Schema]
  const extraAttrs = { ...streamdownMarkdownAllowedTags, ...rehypeGithubAlertsSvgTags }
  return {
    ...ze,
    tagNames: [...new Set([...(ze.tagNames ?? []), ...Object.keys(extraAttrs)])],
    attributes: { ...(ze.attributes ?? {}), ...extraAttrs },
  }
}

/**
 * 与默认 Streamdown 顺序一致：`raw` → GitHub alerts → `sanitize`（合并 allowedTags）→ `harden`。
 * 必须整体传入：若只传 alerts，会替换默认管道并丢掉 sanitize / allowedTags 合并逻辑。
 */
function createStreamdownRehypePlugins(): PluggableList {
  const raw = defaultRehypePlugins.raw
  const sanitizeEntry = defaultRehypePlugins.sanitize
  const harden = defaultRehypePlugins.harden
  if (!Array.isArray(sanitizeEntry)) {
    throw new Error('streamdown: default sanitize plugin must be a tuple')
  }
  const [sanitizePlugin] = sanitizeEntry
  const schema = mergeSanitizeSchemaLikeStreamdown()
  return [raw, [rehypeGithubAlerts, {}], [sanitizePlugin, schema], harden]
}

export const streamdownRehypePlugins = createStreamdownRehypePlugins()
