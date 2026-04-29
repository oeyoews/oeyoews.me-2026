import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Streamdown } from 'streamdown'
import { createCodePlugin } from '@streamdown/code'
import { createCjkPlugin } from '@streamdown/cjk'
import { ArrowLeft, ArrowRight, CalendarDays, FileText, ListTree, PanelLeftOpen, Quote, SearchX, X } from 'lucide-react'
import type { BlogImage, BlogPost, BlogPostMeta, BlogTreeItem } from '../blog/posts'
import BlogFileTree from './blog-file-tree'
import VscodeActivityBar from './vscode-activity-bar'
import { cn } from '@/lib/utils'

type BlogListPageProps = {
  posts: BlogPostMeta[]
  treeItems: BlogTreeItem[]
  activePost?: BlogPost
  activeImage?: BlogImage
  toc?: Array<{ level: 2 | 3; text: string; id: string }>
}

const code = createCodePlugin({
  themes: ['github-light', 'one-dark-pro'],
})
const cjk = createCjkPlugin()

function toHeadingId(text: string) {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[`~!@#$%^&*()+={}\[\]|\\:;"'<>,.?/]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized || 'section'
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return (
    target.isContentEditable ||
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    Boolean(target.closest('[contenteditable="true"]'))
  )
}

export default function BlogListPage({
  posts,
  treeItems,
  activePost,
  activeImage,
  toc = [],
}: BlogListPageProps) {
  const MOBILE_TREE_ANIMATION_MS = 220
  const LEFT_SIDEBAR_MIN_WIDTH = 220
  const LEFT_SIDEBAR_MAX_WIDTH = 520
  const LEFT_SIDEBAR_DEFAULT_WIDTH = 300
  const navigate = useNavigate()
  const contentRef = useRef<HTMLDivElement>(null)
  const tocClickLockUntilRef = useRef(0)
  const pendingGUntilRef = useRef(0)
  const drawerTouchStartXRef = useRef<number | null>(null)
  const drawerTouchStartYRef = useRef<number | null>(null)
  const mobileTreeCloseTimerRef = useRef<number | null>(null)
  const mobileTreeOpenRafRef = useRef<number | null>(null)
  const sidebarResizeStartXRef = useRef<number | null>(null)
  const sidebarResizeStartWidthRef = useRef(LEFT_SIDEBAR_DEFAULT_WIDTH)
  const [showMobileTree, setShowMobileTree] = useState(false)
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false)
  const [sidebarsHidden, setSidebarsHidden] = useState(false)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(LEFT_SIDEBAR_DEFAULT_WIDTH)
  const [isResizingLeftSidebar, setIsResizingLeftSidebar] = useState(false)
  const showToc = Boolean(activePost) && toc.length > 1
  const [activeTocId, setActiveTocId] = useState<string>('')
  const [focusedTocId, setFocusedTocId] = useState<string | undefined>(undefined)
  const [activePane, setActivePane] = useState<'left' | 'right'>('left')
  const [focusedHashid, setFocusedHashid] = useState<string | undefined>(undefined)
  const [focusedTreePath, setFocusedTreePath] = useState<string | undefined>(undefined)
  const [openDirectoryPaths, setOpenDirectoryPaths] = useState<string[]>([])
  const [toggleDirectoryRequest, setToggleDirectoryRequest] = useState<{ path: string; nonce: number }>()
  const leftPaneEntries = useMemo(() => {
    type NavNode = {
      name: string
      path: string
      hashid?: string
      children: Map<string, NavNode>
    }
    const root: NavNode = { name: '', path: '', children: new Map() }

    for (const item of treeItems) {
      const parts = item.treePath.split('/').filter(Boolean)
      let cursor = root
      let acc = ''
      for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i]
        acc = acc ? `${acc}/${part}` : part
        let next = cursor.children.get(part)
        if (!next) {
          next = { name: part, path: acc, children: new Map() }
          cursor.children.set(part, next)
        }
        if (i === parts.length - 1) {
          next.hashid = item.hashid
        }
        cursor = next
      }
    }

    const result: Array<{ path: string; type: 'dir' | 'file'; hashid?: string }> = []
    const walk = (node: NavNode) => {
      const children = Array.from(node.children.values()).sort((a, b) => {
        const aIsFile = Boolean(a.hashid)
        const bIsFile = Boolean(b.hashid)
        if (aIsFile && !bIsFile) return 1
        if (!aIsFile && bIsFile) return -1
        return a.name.localeCompare(b.name)
      })

      for (const child of children) {
        if (child.hashid) {
          result.push({ path: child.path, type: 'file', hashid: child.hashid })
        } else {
          result.push({ path: child.path, type: 'dir' })
          walk(child)
        }
      }
    }

    walk(root)
    return result
  }, [treeItems])
  const openDirectoryPathSet = useMemo(() => new Set(openDirectoryPaths), [openDirectoryPaths])
  const visibleLeftPaneEntries = useMemo(() => {
    const isVisible = (entryPath: string, type: 'dir' | 'file') => {
      const parts = entryPath.split('/').filter(Boolean)
      const end = type === 'dir' ? parts.length - 1 : parts.length - 1
      let acc = ''
      for (let i = 0; i < end; i += 1) {
        acc = acc ? `${acc}/${parts[i]}` : parts[i]
        if (!openDirectoryPathSet.has(acc)) return false
      }
      return true
    }

    return leftPaneEntries.filter((entry) => isVisible(entry.path, entry.type))
  }, [leftPaneEntries, openDirectoryPathSet])
  const currentPostIndex = activePost
    ? posts.findIndex((item) => item.hashid === activePost.meta.hashid)
    : -1
  const prevPost = currentPostIndex > 0 ? posts[currentPostIndex - 1] : undefined
  const nextPost = currentPostIndex >= 0 ? posts[currentPostIndex + 1] : undefined
  const currentHashid = activePost?.meta.hashid ?? activeImage?.meta.hashid
  const hasPostContent = Boolean(activePost?.content.trim())
  const tocIds = useMemo(() => toc.map((item) => item.id), [toc])
  const mainGridStyle = useMemo(
    () => ({ '--left-sidebar-width': `${leftSidebarWidth}px` }) as CSSProperties,
    [leftSidebarWidth],
  )

  const openMobileTree = () => {
    if (mobileTreeCloseTimerRef.current !== null) {
      window.clearTimeout(mobileTreeCloseTimerRef.current)
      mobileTreeCloseTimerRef.current = null
    }
    if (mobileTreeOpenRafRef.current !== null) {
      window.cancelAnimationFrame(mobileTreeOpenRafRef.current)
      mobileTreeOpenRafRef.current = null
    }
    setShowMobileTree(true)
    mobileTreeOpenRafRef.current = window.requestAnimationFrame(() => {
      setMobileTreeOpen(true)
      mobileTreeOpenRafRef.current = null
    })
  }

  const closeMobileTree = () => {
    setMobileTreeOpen(false)
    if (mobileTreeCloseTimerRef.current !== null) {
      window.clearTimeout(mobileTreeCloseTimerRef.current)
    }
    mobileTreeCloseTimerRef.current = window.setTimeout(() => {
      setShowMobileTree(false)
      mobileTreeCloseTimerRef.current = null
    }, MOBILE_TREE_ANIMATION_MS)
  }

  const scrollToHeading = (id: string) => {
    const root = contentRef.current
    if (!root) return
    const target = root.querySelector<HTMLElement>(`[id="${id}"]`)
    if (!target) return
    tocClickLockUntilRef.current = Date.now() + 700
    setActiveTocId(id)
    target.classList.add('toc-heading-flash')
    window.setTimeout(() => target.classList.remove('toc-heading-flash'), 900)
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  useEffect(() => {
    if (!activePost) {
      setActiveTocId('')
      return
    }
    const root = contentRef.current
    if (!root) return

    const headings = Array.from(root.querySelectorAll('h2, h3'))
    const idCount = new Map<string, number>()
    for (const heading of headings) {
      const text = heading.textContent?.trim()
      if (!text) continue
      const base = toHeadingId(text)
      const count = idCount.get(base) ?? 0
      idCount.set(base, count + 1)
      heading.id = count === 0 ? base : `${base}-${count}`
    }

    const scrollContainer = root.closest('.blog-col-main')
    if (!scrollContainer) return

    const updateActiveToc = () => {
      if (Date.now() < tocClickLockUntilRef.current) return
      const headingElements = Array.from(root.querySelectorAll<HTMLElement>('h2, h3'))
      if (!headingElements.length) {
        setActiveTocId('')
        return
      }

      const containerTop = scrollContainer.getBoundingClientRect().top
      const threshold = containerTop + 80
      let currentId = headingElements[0].id

      for (const heading of headingElements) {
        if (heading.getBoundingClientRect().top <= threshold) {
          currentId = heading.id
        } else {
          break
        }
      }

      setActiveTocId(currentId)
    }

    updateActiveToc()
    scrollContainer.addEventListener('scroll', updateActiveToc, { passive: true })
    return () => {
      scrollContainer.removeEventListener('scroll', updateActiveToc)
    }
  }, [activePost?.content])

  useEffect(() => {
    if (!currentHashid) return
    setFocusedHashid(currentHashid)
    const currentItem = treeItems.find((item) => item.hashid === currentHashid)
    if (currentItem) setFocusedTreePath(currentItem.treePath)
  }, [currentHashid, treeItems])

  useEffect(() => {
    if (!focusedTreePath) return
    const isFocusedVisible = visibleLeftPaneEntries.some((entry) => entry.path === focusedTreePath)
    if (isFocusedVisible) return

    const parts = focusedTreePath.split('/').filter(Boolean)
    while (parts.length > 1) {
      parts.pop()
      const parentPath = parts.join('/')
      const parentVisible = visibleLeftPaneEntries.some((entry) => entry.path === parentPath)
      if (parentVisible) {
        setFocusedTreePath(parentPath)
        return
      }
    }

    setFocusedTreePath(visibleLeftPaneEntries[0]?.path)
  }, [focusedTreePath, visibleLeftPaneEntries])

  useEffect(() => {
    if (!showToc && activePane === 'right') {
      setActivePane('left')
    }
  }, [activePane, showToc])

  useEffect(() => {
    if (!showToc) {
      setFocusedTocId(undefined)
      return
    }
    if (activeTocId) {
      setFocusedTocId(activeTocId)
      return
    }
    setFocusedTocId(tocIds[0])
  }, [activeTocId, showToc, tocIds])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (!visibleLeftPaneEntries.length && !tocIds.length) return

      const now = Date.now()

      if (event.key === 'G') {
        event.preventDefault()
        pendingGUntilRef.current = 0
        if (activePane === 'left' && visibleLeftPaneEntries.length) {
          const entry = visibleLeftPaneEntries[visibleLeftPaneEntries.length - 1]
          setFocusedTreePath(entry?.path)
          if (entry?.type === 'file' && entry.hashid) setFocusedHashid(entry.hashid)
        } else if (activePane === 'right' && tocIds.length) {
          setFocusedTocId(tocIds[tocIds.length - 1])
        }
        return
      }

      if (event.key === 'g') {
        event.preventDefault()
        if (now < pendingGUntilRef.current) {
          pendingGUntilRef.current = 0
          if (activePane === 'left' && visibleLeftPaneEntries.length) {
            const entry = visibleLeftPaneEntries[0]
            setFocusedTreePath(entry?.path)
            if (entry?.type === 'file' && entry.hashid) setFocusedHashid(entry.hashid)
          } else if (activePane === 'right' && tocIds.length) {
            setFocusedTocId(tocIds[0])
          }
        } else {
          pendingGUntilRef.current = now + 500
        }
        return
      }

      if (event.key === 'h' || event.key === 'H') {
        event.preventDefault()
        setActivePane('left')
        return
      }

      if (event.key === 'l' || event.key === 'L') {
        if (!showToc) return
        event.preventDefault()
        setActivePane('right')
        return
      }

      if (activePane === 'left') {
        const activeIndex = focusedTreePath
          ? visibleLeftPaneEntries.findIndex((item) => item.path === focusedTreePath)
          : -1

        if (event.key === 'j' || event.key === 'J') {
          event.preventDefault()
          const nextIndex =
            activeIndex < 0 ? 0 : (activeIndex + 1) % visibleLeftPaneEntries.length
          const entry = visibleLeftPaneEntries[nextIndex]
          setFocusedTreePath(entry?.path)
          if (entry?.type === 'file' && entry.hashid) setFocusedHashid(entry.hashid)
          return
        }

        if (event.key === 'k' || event.key === 'K') {
          event.preventDefault()
          const prevIndex =
            activeIndex < 0
              ? visibleLeftPaneEntries.length - 1
              : (activeIndex - 1 + visibleLeftPaneEntries.length) % visibleLeftPaneEntries.length
          const entry = visibleLeftPaneEntries[prevIndex]
          setFocusedTreePath(entry?.path)
          if (entry?.type === 'file' && entry.hashid) setFocusedHashid(entry.hashid)
          return
        }

        if (event.key === 'o' || event.key === 'O') {
          event.preventDefault()
          const entry = focusedTreePath
            ? visibleLeftPaneEntries.find((item) => item.path === focusedTreePath)
            : undefined
          if (!entry) return
          if (entry.type === 'dir') {
            setToggleDirectoryRequest({
              path: entry.path,
              nonce: Date.now(),
            })
            return
          }
          if (!entry.hashid) return
          navigate({
            to: '/blog/$hashid',
            params: { hashid: entry.hashid },
          })
        }
        return
      }

      const focusedIndex = focusedTocId ? tocIds.findIndex((id) => id === focusedTocId) : -1

      if (event.key === 'j' || event.key === 'J') {
        event.preventDefault()
        const nextIndex = focusedIndex < 0 ? 0 : (focusedIndex + 1) % tocIds.length
        setFocusedTocId(tocIds[nextIndex])
        return
      }

      if (event.key === 'k' || event.key === 'K') {
        event.preventDefault()
        const prevIndex = focusedIndex < 0 ? tocIds.length - 1 : (focusedIndex - 1 + tocIds.length) % tocIds.length
        setFocusedTocId(tocIds[prevIndex])
        return
      }

      if (event.key === 'o' || event.key === 'O') {
        if (!focusedTocId) return
        event.preventDefault()
        scrollToHeading(focusedTocId)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    activePane,
    focusedTocId,
    focusedTreePath,
    navigate,
    scrollToHeading,
    showToc,
    tocIds,
    visibleLeftPaneEntries,
  ])

  useEffect(() => {
    if (!isResizingLeftSidebar) return

    const handleMouseMove = (event: MouseEvent) => {
      if (sidebarResizeStartXRef.current === null) return
      const deltaX = event.clientX - sidebarResizeStartXRef.current
      const nextWidth = Math.min(
        LEFT_SIDEBAR_MAX_WIDTH,
        Math.max(LEFT_SIDEBAR_MIN_WIDTH, sidebarResizeStartWidthRef.current + deltaX),
      )
      setLeftSidebarWidth(nextWidth)
    }

    const stopResize = () => {
      setIsResizingLeftSidebar(false)
      sidebarResizeStartXRef.current = null
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopResize)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopResize)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isResizingLeftSidebar, LEFT_SIDEBAR_MAX_WIDTH, LEFT_SIDEBAR_MIN_WIDTH])

  useEffect(() => {
    return () => {
      if (mobileTreeCloseTimerRef.current !== null) {
        window.clearTimeout(mobileTreeCloseTimerRef.current)
      }
      if (mobileTreeOpenRafRef.current !== null) {
        window.cancelAnimationFrame(mobileTreeOpenRafRef.current)
      }
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [])

  return (
    <main className="page-shell">
      {showMobileTree ? (
        <div
          className={cn('mobile-tree-drawer xl:hidden print:hidden', mobileTreeOpen && 'mobile-tree-drawer-open')}
          role="dialog"
          aria-modal="true"
          aria-label="目录"
        >
          <button
            type="button"
            className={cn('mobile-tree-backdrop', mobileTreeOpen && 'mobile-tree-backdrop-open')}
            onClick={closeMobileTree}
            aria-label="关闭目录"
          />
          <div
            className={cn('mobile-tree-panel flex flex-col', mobileTreeOpen && 'mobile-tree-panel-open')}
            onTouchStart={(event) => {
              const touch = event.touches[0]
              drawerTouchStartXRef.current = touch?.clientX ?? null
              drawerTouchStartYRef.current = touch?.clientY ?? null
            }}
            onTouchMove={(event) => {
              if (drawerTouchStartXRef.current == null || drawerTouchStartYRef.current == null) return
              const touch = event.touches[0]
              if (!touch) return
              const deltaX = touch.clientX - drawerTouchStartXRef.current
              const deltaY = Math.abs(touch.clientY - drawerTouchStartYRef.current)
              // Horizontal swipe right closes drawer
              if (deltaX > 60 && deltaY < 40) {
                closeMobileTree()
                drawerTouchStartXRef.current = null
                drawerTouchStartYRef.current = null
              }
            }}
            onTouchEnd={() => {
              drawerTouchStartXRef.current = null
              drawerTouchStartYRef.current = null
            }}
          >
            <div className="border-b border-[#2f3750] px-3 py-2">
              <p className="text-sm font-medium text-[#dbe5ff]">目录</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-16">
              <BlogFileTree
                items={treeItems}
                currentHashid={currentHashid}
                focusedHashid={focusedHashid}
                focusedTreePath={focusedTreePath}
                toggleDirectoryRequest={toggleDirectoryRequest}
                onOpenPathsChange={setOpenDirectoryPaths}
                onSelectFile={closeMobileTree}
              />
            </div>
            <button
              type="button"
              onClick={closeMobileTree}
              className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded border border-[#33415f] bg-[#222e4a]/95 px-2.5 py-1.5 text-xs text-[#c8d3f0] shadow-sm backdrop-blur hover:bg-[#2a3450] hover:text-[#e4eafd]"
            >
              <X className="size-3.5 shrink-0" />
              <span>关闭</span>
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'main-grid print:block',
          !showToc && !sidebarsHidden && 'main-grid-no-toc',
          sidebarsHidden && 'main-grid-focus-mode',
        )}
        style={mainGridStyle}
      >
        <div className={cn('blog-side-panel print:hidden', sidebarsHidden && 'blog-side-panel-focus', activePane === 'left' && !sidebarsHidden && 'pane-focused')}>
          <div className="vscode-explorer-shell">
            <VscodeActivityBar
              active="files"
              sidebarsHidden={sidebarsHidden}
              onToggleSidebars={() => setSidebarsHidden((prev) => !prev)}
            />
            <div
              className={cn('vscode-explorer-content', sidebarsHidden && 'vscode-explorer-content-collapsed')}
              aria-hidden={sidebarsHidden}
            >
              <BlogFileTree
                items={treeItems}
                currentHashid={currentHashid}
                focusedHashid={focusedHashid}
                focusedTreePath={focusedTreePath}
                toggleDirectoryRequest={toggleDirectoryRequest}
                onOpenPathsChange={setOpenDirectoryPaths}
                onSelectFile={() => setShowMobileTree(false)}
              />
            </div>
            {!sidebarsHidden ? (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="调整左侧边栏宽度"
                className={cn(
                  'vscode-sidebar-resize-handle',
                  isResizingLeftSidebar && 'vscode-sidebar-resize-handle-resizing',
                )}
                onMouseDown={(event) => {
                  if (event.button !== 0) return
                  event.preventDefault()
                  sidebarResizeStartXRef.current = event.clientX
                  sidebarResizeStartWidthRef.current = leftSidebarWidth
                  setIsResizingLeftSidebar(true)
                }}
              />
            ) : null}
          </div>
        </div>

        <section className="blog-col-main print:h-auto print:overflow-visible print:border-0 print:bg-white print:px-0 print:pt-0 print:pb-0">
          <div className="blog-main-inner">
            <div className="mb-4 xl:hidden print:hidden">
              <button
                type="button"
                onClick={openMobileTree}
                className="inline-flex items-center gap-1.5 rounded border border-[#2f3750] bg-[#202739] px-3 py-1.5 text-sm text-[#dbe5ff] hover:bg-[#2a3450]"
              >
                <PanelLeftOpen className="size-4 shrink-0" />
                <span>打开目录树</span>
              </button>
            </div>
            <div key={currentHashid ?? 'empty'} className="blog-content-fade-enter">
              {activePost ? (
                <>
                <header className="mb-6 print:mb-4">
                  {activePost.meta.title ? (
                    <h1 className="m-0 text-[24px] leading-[1.2] font-semibold tracking-tight text-[#e7ecff] print:text-black xl:text-[28px]">
                      {activePost.meta.title}
                    </h1>
                  ) : null}
                  {activePost.meta.date ? (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[#9aa6c5] print:text-gray-600">
                      <CalendarDays className="size-3.5 shrink-0" />
                      <time>{activePost.meta.date}</time>
                    </p>
                  ) : null}
                  {activePost.meta.description ? (
                    <p className="mt-4 inline-flex w-full items-start gap-2 rounded-md border border-[#2a3450] bg-[#131b2c] px-3 py-2 text-[13px] leading-6 text-[#b7c2df] print:border-gray-300 print:bg-white print:text-gray-700">
                      <Quote className="mt-1 size-3 shrink-0 text-[#7f8aac] print:text-gray-500" />
                      <span>{activePost.meta.description}</span>
                    </p>
                  ) : null}
                </header>

                {hasPostContent ? (
                  <div
                    key={activePost.meta.hashid}
                    ref={contentRef}
                    className="blog-article-content max-w-none prose-pre:my-0"
                  >
                    <Streamdown linkSafety={{ enabled: false }} key={activePost.meta.hashid} mode="static" plugins={{ code, cjk }} controls={{ code: { download: false } }}>
                      {activePost.content}
                    </Streamdown>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[#2f3750] bg-[#101624] px-4 py-8 text-center text-sm text-[#9aa6c5]">
                    <FileText className="mx-auto mb-2 size-5 text-[#8f9bbd]" />
                    当前文章暂无正文内容，可以从左侧目录切换到其他文章。
                  </div>
                )}

                <nav className="mt-10 grid gap-3 border-t border-[#2f3750] pt-6 print:hidden sm:grid-cols-2">
                  {prevPost ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          to: '/blog/$hashid',
                          params: { hashid: prevPost.hashid },
                        })
                      }
                      className="cursor-pointer rounded-lg border border-[#2f3750] bg-[#12182a] px-4 py-3 text-left text-sm text-[#b1bcda] transition-colors hover:border-[#3c4668] hover:text-[#e7ecff]"
                    >
                      <span className="mb-1 inline-flex items-center gap-1 text-xs text-[#8f9bbd]">
                        <ArrowLeft className="size-3.5 shrink-0" />
                        <span>上一篇</span>
                      </span>
                      {prevPost.title ? (
                        <span className="line-clamp-2 block">{prevPost.title}</span>
                      ) : null}
                    </button>
                  ) : (
                    <div className="rounded-lg border border-dashed border-[#2f3750] bg-[#101624] px-4 py-3 text-sm text-[#7f8aac]">
                      <span className="mb-1 inline-flex items-center gap-1 text-xs text-[#8f9bbd]">
                        <ArrowLeft className="size-3.5 shrink-0 opacity-80" />
                        <span>上一篇</span>
                      </span>
                      <span className="block text-[#7f8aac]">已经是最新一篇</span>
                    </div>
                  )}

                  {nextPost ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          to: '/blog/$hashid',
                          params: { hashid: nextPost.hashid },
                        })
                      }
                      className="cursor-pointer rounded-lg border border-[#2f3750] bg-[#12182a] px-4 py-3 text-right text-sm text-[#b1bcda] transition-colors hover:border-[#3c4668] hover:text-[#e7ecff]"
                    >
                      <span className="mb-1 inline-flex items-center gap-1 text-xs text-[#8f9bbd]">
                        <span>下一篇</span>
                        <ArrowRight className="size-3.5 shrink-0" />
                      </span>
                      {nextPost.title ? (
                        <span className="line-clamp-2 block">{nextPost.title}</span>
                      ) : null}
                    </button>
                  ) : (
                    <div className="rounded-lg border border-dashed border-[#2f3750] bg-[#101624] px-4 py-3 text-right text-sm text-[#7f8aac]">
                      <span className="mb-1 inline-flex items-center gap-1 text-xs text-[#8f9bbd]">
                        <span>下一篇</span>
                        <ArrowRight className="size-3.5 shrink-0 opacity-80" />
                      </span>
                      <span className="block text-[#7f8aac]">已经是最后一篇</span>
                    </div>
                  )}
                </nav>
                </>
              ) : activeImage ? (
                <div className="space-y-4">
                <header>
                  <h1 className="m-0 text-[24px] leading-[1.2] font-semibold tracking-tight text-[#e7ecff]">
                    {activeImage.meta.title}
                  </h1>
                  <p className="mt-3 text-[12px] text-[#9aa6c5]">{activeImage.meta.sourcePath}</p>
                </header>
                <div className="overflow-hidden rounded-lg border border-[#2f3750] bg-[#161b27] p-2">
                  <img
                    src={activeImage.imageUrl}
                    alt={activeImage.meta.title}
                    className="mx-auto block max-h-[75dvh] w-auto max-w-full rounded"
                    loading="lazy"
                  />
                </div>
                </div>
              ) : (
                <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
                <SearchX className="size-9 text-[#8f9bbd]" />
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">文章不存在</h1>
                <p className="text-sm text-muted-foreground">请从左侧目录选择其他文章继续预览</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {showToc && !sidebarsHidden ? (
          <aside className={cn('blog-col-right blog-side-panel print:hidden', activePane === 'right' && 'pane-focused')}>
            <p className="toc-panel-title flex w-full items-center gap-1.5">
              <ListTree className="size-4 shrink-0" />
              <span>本页目录</span>
            </p>
            <ul className="toc-list">
              {toc.map((item) => (
                <li
                  key={`${item.level}-${item.id}`}
                  className={cn(
                    'toc-item',
                    item.level === 3 && 'toc-item-child',
                    activeTocId === item.id && 'toc-item-active',
                    focusedTocId === item.id && activePane === 'right' && 'toc-item-focused',
                  )}
                >
                  <a
                    href={`#${item.id}`}
                    className="toc-link"
                    onClick={(event) => {
                      event.preventDefault()
                      scrollToHeading(item.id)
                    }}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </main>
  )
}
