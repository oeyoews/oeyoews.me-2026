import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState, Prec } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { vim, Vim } from '@replit/codemirror-vim'
import { useEffect, useLayoutEffect, useRef } from 'react'

import { BLOG_DEV_MD_EDITOR_FONT_SIZE_DEFAULT_PX } from '@/lib/blog-dev-editor-prefs'
import { cn } from '@/lib/utils'

let vimJkEscapeMapped = false
function ensureVimJkMapsInsertToNormal() {
  if (vimJkEscapeMapped) return
  Vim.noremap('jk', '<Esc>', 'insert')
  vimJkEscapeMapped = true
}

export type BlogDevCodemirrorMarkdownProps = {
  editorKey: string
  value: string
  onChange: (next: string) => void
  onSaveShortcut?: () => void
  className?: string
  /** 是否启用 Vim 键位；关闭后为常规编辑（仍保留撤销等） */
  vimKeybindings?: boolean
  /** 编辑区 `font-family` CSS 值 */
  fontFamily?: string
  /** 编辑区字号（像素） */
  fontSizePx?: number
}

/** 与 One Dark 搭配的布局（字号、伸缩、行高），不着色面板与文本 */
function editorLayoutTheme(fontSizePx: number) {
  return EditorView.theme(
    {
      '&': {
        fontSize: `${fontSizePx}px`,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      },
      '.cm-scroller': {
        flex: 1,
        minHeight: 0,
        lineHeight: '1.625',
      },
      '.cm-content': { paddingBlock: '12px' },
    },
    { dark: true },
  )
}

function editorFontTheme(fontFamily: string) {
  return EditorView.theme(
    {
      '.cm-scroller': { fontFamily },
      '.cm-gutters': { fontFamily },
    },
    { dark: true },
  )
}

/**
 * 覆盖 One Dark 的 `&` / `.cm-gutters` 等（#282c34 / 行号槽）。
 * 视图会把 `styleModule` facet 收集后 `.concat(base).reverse()` 再挂载；facet 里**更靠前**的模块会**最后**写入样式表、同优先级下生效。
 * 用 `Prec.highest` 提高该主题的扩展优先级，才能稳定压过同级的 oneDark（单靠 extensions 数组里的先后顺序不可靠）。
 */
function blogDevMarkdownAppearanceTheme() {
  const gutterChrome = {
    backgroundColor: 'var(--color-card)',
    color: 'var(--color-muted-foreground)',
    borderRight: '1px solid var(--color-border)',
    borderTop: 'none',
    borderBottom: 'none',
    borderLeft: 'none',
  } as const

  return Prec.highest(
    EditorView.theme(
      {
        '&': { backgroundColor: 'var(--color-card)' },
        '.cm-scroller': { backgroundColor: 'var(--color-card)' },
        '.cm-gutters': gutterChrome,
        '.cm-gutter': { backgroundColor: 'transparent' },
        '.cm-activeLineGutter': { backgroundColor: 'var(--color-muted)' },
      },
      { dark: true },
    ),
  )
}

/** 将编辑区内「无处可滚」或已到顶/底的滚轮交给外层（如 `.blog-content-columns`），避免嵌套滚动吃掉事件 */
function scrollWheelForwardExtension() {
  const EPS = 2

  function nearestVerticalScrollParent(from: HTMLElement | null): HTMLElement | null {
    let el = from
    while (el && el !== document.documentElement) {
      const { overflowY } = window.getComputedStyle(el)
      if (
        (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
        el.scrollHeight > el.clientHeight + EPS
      ) {
        return el
      }
      el = el.parentElement
    }
    return null
  }

  return EditorView.domEventHandlers({
    wheel(event, view) {
      if (event.deltaY === 0) return false

      const scroller = view.scrollDOM
      const { scrollTop, scrollHeight, clientHeight } = scroller
      const dy = event.deltaY
      const hasOverflow = scrollHeight > clientHeight + EPS
      const atTop = scrollTop <= EPS
      const atBottom = scrollTop + clientHeight >= scrollHeight - EPS

      const forward =
        !hasOverflow || (dy < 0 && atTop) || (dy > 0 && atBottom)

      if (!forward) return false

      const host = nearestVerticalScrollParent(scroller.parentElement)
      if (!host) return false

      const before = host.scrollTop
      host.scrollTop += dy
      if (host.scrollTop === before) return false

      event.preventDefault()
      return true
    },
  })
}

export default function BlogDevCodemirrorMarkdown({
  editorKey,
  value,
  onChange,
  onSaveShortcut,
  className,
  vimKeybindings = true,
  fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSizePx = BLOG_DEV_MD_EDITOR_FONT_SIZE_DEFAULT_PX,
}: BlogDevCodemirrorMarkdownProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSaveShortcutRef = useRef(onSaveShortcut)
  onChangeRef.current = onChange
  onSaveShortcutRef.current = onSaveShortcut

  const valueRef = useRef(value)
  valueRef.current = value

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return

    if (vimKeybindings) {
      ensureVimJkMapsInsertToNormal()
    }

    const saveMap = keymap.of([
      {
        key: 'Mod-s',
        preventDefault: true,
        run: () => {
          onSaveShortcutRef.current?.()
          return true
        },
      },
    ])

    const state = EditorState.create({
      doc: valueRef.current,
      extensions: [
        markdown(),
        oneDark,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        history(),
        lineNumbers(),
        EditorView.lineWrapping,
        scrollWheelForwardExtension(),
        editorLayoutTheme(fontSizePx),
        editorFontTheme(fontFamily),
        keymap.of([indentWithTab]),
        keymap.of(historyKeymap),
        keymap.of(defaultKeymap),
        ...(vimKeybindings ? [vim()] : []),
        blogDevMarkdownAppearanceTheme(),
        Prec.highest(saveMap),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
      ],
    })

    const view = new EditorView({ state, parent: host })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [editorKey, vimKeybindings, fontFamily, fontSizePx])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const cur = view.state.doc.toString()
    if (cur === value) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    })
  }, [value])

  return (
    <div
      ref={hostRef}
      className={cn(
        'blog-dev-codemirror flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card',
        '[&_.cm-editor]:outline-none',
        className,
      )}
      aria-label="Markdown 源码"
    />
  )
}
