import { defaultRehypePlugins } from 'streamdown'
import { rehypeGithubAlerts } from 'rehype-github-alerts'
import type { Schema } from 'hast-util-sanitize'
import type { PluggableList } from 'unified'
import { streamdownMarkdownAllowedTags } from '@/lib/streamdown-markdown-allowed-tags'

/** `rehype-github-alerts` v4 会为警报标题插入 Octicon 矢量图标；GitHub 默认的 sanitize 规则未放行 svg/path，须在模式中显式允许 */
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
    throw new Error('streamdown：默认 sanitize 插件须为 [插件, 配置] 元组')
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
 * 与 Streamdown 默认管线顺序一致：`raw` → GitHub 提示框（rehypeGithubAlerts）→ `sanitize`（合并允许标签）→ `harden`。
 * 须返回完整列表一次性传入：若只单独传入提示框插件，会覆盖默认 rehype 列表，从而丢失 sanitize 与允许标签的合并逻辑。
 */
function createStreamdownRehypePlugins(): PluggableList {
  const raw = defaultRehypePlugins.raw
  const sanitizeEntry = defaultRehypePlugins.sanitize
  const harden = defaultRehypePlugins.harden
  if (!Array.isArray(sanitizeEntry)) {
    throw new Error('streamdown：默认 sanitize 插件须为 [插件, 配置] 元组')
  }
  const [sanitizePlugin] = sanitizeEntry
  const schema = mergeSanitizeSchemaLikeStreamdown()
  return [raw, [rehypeGithubAlerts, {}], [sanitizePlugin, schema], harden]
}

export const streamdownRehypePlugins = createStreamdownRehypePlugins()
