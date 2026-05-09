const STORAGE_KEY = 'blog-sidebar-ui-prefs'

/** 左侧文件树最小宽度（px） */
export const BLOG_LEFT_SIDEBAR_MIN_WIDTH = 220
/** 左侧文件树最大宽度（px） */
export const BLOG_LEFT_SIDEBAR_MAX_WIDTH = 520
/** 左侧文件树默认宽度（px） */
export const BLOG_LEFT_SIDEBAR_DEFAULT_WIDTH = 300

const OPEN_DIRS_MAX = 500

export type BlogSidebarUiPrefs = {
  /** 专注模式：隐藏左右侧栏 */
  sidebarsHidden: boolean
  leftSidebarWidth: number
  /** 键盘焦点在左侧目录还是右侧大纲 */
  activePane: 'left' | 'right'
  /** 右侧「本页目录」面板是否收起（与专注模式无关） */
  tocPanelCollapsed: boolean
  /** 文件树中展开的目录路径 */
  openDirectoryPaths: string[]
}

export const BLOG_SIDEBAR_UI_DEFAULT_PREFS: BlogSidebarUiPrefs = {
  sidebarsHidden: false,
  leftSidebarWidth: BLOG_LEFT_SIDEBAR_DEFAULT_WIDTH,
  activePane: 'left',
  tocPanelCollapsed: false,
  openDirectoryPaths: [],
}

function clampWidth(n: number): number {
  if (!Number.isFinite(n)) return BLOG_LEFT_SIDEBAR_DEFAULT_WIDTH
  return Math.min(
    BLOG_LEFT_SIDEBAR_MAX_WIDTH,
    Math.max(BLOG_LEFT_SIDEBAR_MIN_WIDTH, Math.round(n)),
  )
}

function coercePrefs(raw: unknown): BlogSidebarUiPrefs {
  if (!raw || typeof raw !== 'object') return BLOG_SIDEBAR_UI_DEFAULT_PREFS
  const o = raw as Record<string, unknown>
  const sidebarsHidden =
    typeof o.sidebarsHidden === 'boolean'
      ? o.sidebarsHidden
      : BLOG_SIDEBAR_UI_DEFAULT_PREFS.sidebarsHidden
  const leftSidebarWidth = clampWidth(
    typeof o.leftSidebarWidth === 'number'
      ? o.leftSidebarWidth
      : BLOG_SIDEBAR_UI_DEFAULT_PREFS.leftSidebarWidth,
  )
  const ap = o.activePane
  const activePane =
    ap === 'left' || ap === 'right' ? ap : BLOG_SIDEBAR_UI_DEFAULT_PREFS.activePane
  const tocPanelCollapsed =
    typeof o.tocPanelCollapsed === 'boolean'
      ? o.tocPanelCollapsed
      : BLOG_SIDEBAR_UI_DEFAULT_PREFS.tocPanelCollapsed
  let openDirectoryPaths = BLOG_SIDEBAR_UI_DEFAULT_PREFS.openDirectoryPaths
  if (Array.isArray(o.openDirectoryPaths)) {
    openDirectoryPaths = o.openDirectoryPaths
      .filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 2048)
      .slice(0, OPEN_DIRS_MAX)
  }
  return { sidebarsHidden, leftSidebarWidth, activePane, tocPanelCollapsed, openDirectoryPaths }
}

export function readBlogSidebarUiPrefs(): BlogSidebarUiPrefs {
  if (typeof window === 'undefined') return BLOG_SIDEBAR_UI_DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return BLOG_SIDEBAR_UI_DEFAULT_PREFS
    const parsed = JSON.parse(raw) as unknown
    return coercePrefs(parsed)
  } catch {
    return BLOG_SIDEBAR_UI_DEFAULT_PREFS
  }
}

export function writeBlogSidebarUiPrefs(next: BlogSidebarUiPrefs): void {
  if (typeof window === 'undefined') return
  try {
    const payload: BlogSidebarUiPrefs = {
      ...next,
      leftSidebarWidth: clampWidth(next.leftSidebarWidth),
      tocPanelCollapsed: next.tocPanelCollapsed,
      openDirectoryPaths: next.openDirectoryPaths
        .filter((x) => typeof x === 'string' && x.length > 0)
        .slice(0, OPEN_DIRS_MAX),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* quota / 隐私模式 */
  }
}
