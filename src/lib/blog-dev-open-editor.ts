import { withBaseUrl } from '@/lib/base-url'

export type ExternalEditorKind = 'vscode' | 'cursor'

/** 由开发服务器调起本机资源管理器 / 终端（仅 `bun run dev` 可用）。 */
export type BlogDevShellOpenAction = 'explorer' | 'terminal'

/** `vscode://file/...` / `cursor://file/...`，路径为本地绝对路径（正斜杠）。 */
export function protocolUrlForLocalFile(absolutePath: string, kind: ExternalEditorKind): string {
  const normalized = absolutePath.replace(/\\/g, '/')
  const protocol = kind === 'cursor' ? 'cursor' : 'vscode'
  return `${protocol}://file/${encodeURI(normalized)}`
}

export async function fetchAbsoluteMarkdownPath(sourcePath: string): Promise<string> {
  const url = withBaseUrl(`__dev/api/blog-md-path?sourcePath=${encodeURIComponent(sourcePath)}`)
  const res = await fetch(url)
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(t || res.statusText)
  }
  const data = (await res.json()) as { absolutePath?: string }
  if (typeof data.absolutePath !== 'string' || !data.absolutePath) {
    throw new Error('invalid response')
  }
  return data.absolutePath
}

export async function openMarkdownInEditor(sourcePath: string, kind: ExternalEditorKind): Promise<void> {
  const abs = await fetchAbsoluteMarkdownPath(sourcePath)
  const href = protocolUrlForLocalFile(abs, kind)
  const a = document.createElement('a')
  a.href = href
  a.rel = 'noopener noreferrer'
  a.click()
}

export async function openBlogLocalShell(sourcePath: string, action: BlogDevShellOpenAction): Promise<void> {
  const res = await fetch(withBaseUrl('__dev/api/blog-open-local'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcePath, action }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(t || res.statusText)
  }
}
