import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import {
  defaultHighlightStyle,
  HighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { tags } from '@lezer/highlight'
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

function editorShellTheme(fontSizePx: number) {
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
      '.cm-content': { caretColor: 'var(--color-foreground)', paddingBlock: '12px' },
      '.cm-gutters': {
        backgroundColor: 'color-mix(in srgb, var(--color-muted) 88%, transparent)',
        color: 'var(--color-muted-foreground)',
        border: 'none',
        borderRight: '1px solid var(--color-border)',
      },
      '.cm-activeLineGutter': { backgroundColor: 'transparent' },
      '.cm-activeLine': {
        backgroundColor: 'color-mix(in srgb, var(--color-muted) 45%, transparent)',
      },
      '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--color-foreground)' },
      '&.cm-focused .cm-selectionBackground': {
        background: 'color-mix(in srgb, var(--color-primary) 28%, transparent) !important',
      },
      '.cm-selectionBackground': {
        background: 'color-mix(in srgb, var(--color-primary) 22%, transparent) !important',
      },
    },
    { dark: false },
  )
}

function editorFontTheme(fontFamily: string) {
  return EditorView.theme(
    {
      '.cm-scroller': { fontFamily },
      '.cm-gutters': { fontFamily },
    },
    { dark: false },
  )
}

/** Markdown 结构与站点色板；代码块内嵌语言仍由 defaultHighlightStyle 着色 */
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

const markdownSyntaxHighlight = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--color-primary)', fontWeight: '700' },
  { tag: tags.quote, color: 'var(--color-muted-foreground)', fontStyle: 'italic' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--color-muted-foreground)' },
  { tag: tags.link, color: 'var(--color-primary)' },
  { tag: tags.url, color: 'color-mix(in srgb, var(--color-primary) 72%, var(--color-muted-foreground))' },
  { tag: tags.monospace, color: 'color-mix(in srgb, var(--color-foreground) 88%, var(--color-primary))' },
  { tag: tags.meta, color: 'var(--color-muted-foreground)' },
  { tag: tags.comment, color: 'var(--color-muted-foreground)', fontStyle: 'italic' },
  { tag: tags.list, color: 'color-mix(in srgb, var(--color-muted-foreground) 90%, var(--color-foreground))' },
  { tag: tags.punctuation, color: 'color-mix(in srgb, var(--color-muted-foreground) 82%, transparent)' },
  { tag: tags.processingInstruction, color: 'var(--color-muted-foreground)' },
])

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
        syntaxHighlighting(markdownSyntaxHighlight),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        history(),
        lineNumbers(),
        EditorView.lineWrapping,
        scrollWheelForwardExtension(),
        editorShellTheme(fontSizePx),
        editorFontTheme(fontFamily),
        keymap.of([indentWithTab]),
        keymap.of(historyKeymap),
        keymap.of(defaultKeymap),
        ...(vimKeybindings ? [vim()] : []),
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
        'blog-dev-codemirror flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground',
        '[&_.cm-editor]:outline-none',
        className,
      )}
      aria-label="Markdown 源码"
    />
  )
}
