const STORAGE_KEY = 'blog-dev-md-editor-prefs'

export type BlogDevMdEditorFontId =
  | 'mono-system'
  | 'jetbrains-mono'
  | 'fira-code'
  | 'geist-mono'
  | 'sans-readable'

export const BLOG_DEV_MD_EDITOR_FONT_SIZE_MIN_PX = 11
export const BLOG_DEV_MD_EDITOR_FONT_SIZE_MAX_PX = 22
export const BLOG_DEV_MD_EDITOR_FONT_SIZE_DEFAULT_PX = 16

/** 编辑器字号下拉选项（px），与 clamp 范围一致 */
export const BLOG_DEV_MD_EDITOR_FONT_SIZE_OPTIONS: ReadonlyArray<number> = Array.from(
  { length: BLOG_DEV_MD_EDITOR_FONT_SIZE_MAX_PX - BLOG_DEV_MD_EDITOR_FONT_SIZE_MIN_PX + 1 },
  (_, i) => BLOG_DEV_MD_EDITOR_FONT_SIZE_MIN_PX + i,
)

export type BlogDevMdEditorPrefs = {
  /** 是否使用 Vim 键位（插入模式下 jk 映射为 Esc 等在编辑器内注册） */
  vimEnabled: boolean
  fontId: BlogDevMdEditorFontId
  /** 源码编辑器字号（像素） */
  fontSizePx: number
  /** 源码模式下是否显示右侧实时预览 */
  livePreviewEnabled: boolean
}

export const BLOG_DEV_MD_EDITOR_DEFAULT_PREFS: BlogDevMdEditorPrefs = {
  vimEnabled: true,
  fontId: 'mono-system',
  fontSizePx: BLOG_DEV_MD_EDITOR_FONT_SIZE_DEFAULT_PX,
  livePreviewEnabled: true,
}

export const BLOG_DEV_MD_EDITOR_FONT_OPTIONS: ReadonlyArray<{
  id: BlogDevMdEditorFontId
  label: string
  cssFontFamily: string
}> = [
  {
    id: 'mono-system',
    label: '系统等宽',
    cssFontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    cssFontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  {
    id: 'fira-code',
    label: 'Fira Code',
    cssFontFamily: '"Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  {
    id: 'geist-mono',
    label: 'Geist Mono',
    cssFontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  {
    id: 'sans-readable',
    label: '无衬线（易读）',
    cssFontFamily: 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
  },
]

const FONT_IDS = new Set(BLOG_DEV_MD_EDITOR_FONT_OPTIONS.map((o) => o.id))

export function clampBlogDevMdEditorFontSizePx(n: number): number {
  const x = Math.round(Number(n))
  if (!Number.isFinite(x)) return BLOG_DEV_MD_EDITOR_FONT_SIZE_DEFAULT_PX
  return Math.min(BLOG_DEV_MD_EDITOR_FONT_SIZE_MAX_PX, Math.max(BLOG_DEV_MD_EDITOR_FONT_SIZE_MIN_PX, x))
}

function coercePrefs(raw: unknown): BlogDevMdEditorPrefs {
  if (!raw || typeof raw !== 'object') return BLOG_DEV_MD_EDITOR_DEFAULT_PREFS
  const o = raw as Record<string, unknown>
  const vimEnabled = typeof o.vimEnabled === 'boolean' ? o.vimEnabled : BLOG_DEV_MD_EDITOR_DEFAULT_PREFS.vimEnabled
  const fid = o.fontId
  const fontId =
    typeof fid === 'string' && FONT_IDS.has(fid as BlogDevMdEditorFontId)
      ? (fid as BlogDevMdEditorFontId)
      : BLOG_DEV_MD_EDITOR_DEFAULT_PREFS.fontId
  const fontSizePx =
    typeof o.fontSizePx === 'number' && Number.isFinite(o.fontSizePx)
      ? clampBlogDevMdEditorFontSizePx(o.fontSizePx)
      : BLOG_DEV_MD_EDITOR_DEFAULT_PREFS.fontSizePx
  const livePreviewEnabled =
    typeof o.livePreviewEnabled === 'boolean'
      ? o.livePreviewEnabled
      : BLOG_DEV_MD_EDITOR_DEFAULT_PREFS.livePreviewEnabled
  return { vimEnabled, fontId, fontSizePx, livePreviewEnabled }
}

/** 兼容旧版只存 inputMode 的字段 */
function migrateLegacy(raw: Record<string, unknown>): Record<string, unknown> {
  if (typeof raw.vimEnabled === 'boolean') return raw
  const mode = raw.inputMode
  if (mode === 'standard' || mode === 'vim') {
    return { ...raw, vimEnabled: mode === 'vim' }
  }
  return raw
}

export function readBlogDevMdEditorPrefs(): BlogDevMdEditorPrefs {
  if (typeof window === 'undefined') return BLOG_DEV_MD_EDITOR_DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return BLOG_DEV_MD_EDITOR_DEFAULT_PREFS
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return BLOG_DEV_MD_EDITOR_DEFAULT_PREFS
    return coercePrefs(migrateLegacy(parsed as Record<string, unknown>))
  } catch {
    return BLOG_DEV_MD_EDITOR_DEFAULT_PREFS
  }
}

export function writeBlogDevMdEditorPrefs(next: BlogDevMdEditorPrefs): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* quota / private mode */
  }
}

export function fontFamilyForBlogDevEditor(fontId: BlogDevMdEditorFontId): string {
  return BLOG_DEV_MD_EDITOR_FONT_OPTIONS.find((o) => o.id === fontId)?.cssFontFamily ?? BLOG_DEV_MD_EDITOR_FONT_OPTIONS[0].cssFontFamily
}
