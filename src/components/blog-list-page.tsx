import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Streamdown } from 'streamdown'
import { createCodePlugin } from '@streamdown/code'
import { createCjkPlugin } from '@streamdown/cjk'
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Copy, Download, ExternalLink, FileText, Link2, ListTree, Lock, PanelLeftOpen, Quote, SearchX, X } from 'lucide-react'
import type { BlogImage, BlogPost, BlogPostMeta, BlogTreeItem } from '../blog/posts'
import { encodeShareToken } from '../blog/share-id'
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

type KeyboardNavNode = {
  name: string
  path: string
  hashid?: string
  children: Map<string, KeyboardNavNode>
}

const code = createCodePlugin({
  themes: ['github-light', 'one-dark-pro'],
})
const cjk = createCjkPlugin()

function createKeyboardNavNode(name: string, path = ''): KeyboardNavNode {
  return {
    name,
    path,
    children: new Map(),
  }
}

function toLabel(name: string) {
  return name.replace(/[-_]/g, ' ')
}

function getPostFallbackTitle(treePath: string) {
  const parts = treePath.split('/').filter(Boolean)
  const last = parts.at(-1) ?? treePath
  if (last.toLowerCase() === 'index') {
    const parent = parts.at(-2)
    return parent ? toLabel(parent) : toLabel(last)
  }
  return toLabel(last)
}

function getPostDisplayTitle(post: BlogPostMeta) {
  const title = post.title?.trim()
  return title ? title : getPostFallbackTitle(post.treePath)
}

function compareKeyboardNavNodes(a: KeyboardNavNode, b: KeyboardNavNode) {
  const aIsIndex = a.name.toLowerCase() === 'index'
  const bIsIndex = b.name.toLowerCase() === 'index'
  if (aIsIndex && !bIsIndex) return -1
  if (!aIsIndex && bIsIndex) return 1

  const aIsFile = Boolean(a.hashid)
  const bIsFile = Boolean(b.hashid)
  if (aIsFile && !bIsFile) return 1
  if (!aIsFile && bIsFile) return -1
  return a.name.localeCompare(b.name)
}

function buildKeyboardNavEntries(
  treeItems: BlogTreeItem[],
): Array<{ path: string; type: 'dir' | 'file'; hashid?: string }> {
  const root = createKeyboardNavNode('', '')

  for (const item of treeItems) {
    const parts = item.treePath.split('/').filter(Boolean)
    let cursor = root
    let acc = ''

    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]
      acc = acc ? `${acc}/${part}` : part
      const isFile = i === parts.length - 1
      const key = isFile ? `${part}__file` : `${part}__dir`
      let next = cursor.children.get(key)
      if (!next) {
        next = createKeyboardNavNode(part, acc)
        cursor.children.set(key, next)
      }
      if (isFile) next.hashid = item.hashid
      cursor = next
    }
  }

  const collapseDirectoryChains = (node: KeyboardNavNode): KeyboardNavNode => {
    if (node.children.size > 0) {
      const collapsedChildren = new Map<string, KeyboardNavNode>()
      for (const child of node.children.values()) {
        const collapsed = collapseDirectoryChains(child)
        const key = collapsed.hashid ? `${collapsed.name}__file` : `${collapsed.name}__dir`
        collapsedChildren.set(key, collapsed)
      }
      node.children = collapsedChildren
    }

    if (node.hashid) return node

    while (node.children.size === 1) {
      const [onlyChild] = Array.from(node.children.values())
      if (!onlyChild || onlyChild.hashid) break
      node.name = node.name ? `${node.name}/${onlyChild.name}` : onlyChild.name
      node.path = node.path ? `${node.path}/${onlyChild.name}` : onlyChild.name
      node.children = onlyChild.children
    }

    return node
  }

  if (root.children.size > 0) {
    const collapsedRootChildren = new Map<string, KeyboardNavNode>()
    for (const child of root.children.values()) {
      const collapsed = collapseDirectoryChains(child)
      const key = collapsed.hashid ? `${collapsed.name}__file` : `${collapsed.name}__dir`
      collapsedRootChildren.set(key, collapsed)
    }
    root.children = collapsedRootChildren
  }

  const result: Array<{ path: string; type: 'dir' | 'file'; hashid?: string }> = []
  const walk = (node: KeyboardNavNode) => {
    const children = Array.from(node.children.values()).sort(compareKeyboardNavNodes)
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
}

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

async function copyTextToClipboard(text: string) {
  if (typeof window === 'undefined') return false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // ignore and fallback
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
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
  const mainScrollRef = useRef<HTMLElement | null>(null)
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
  const [shareMenuOpen, setShareMenuOpen] = useState(false)
  const [shareAction, setShareAction] = useState<'copy-link' | 'copy-article' | 'download-md' | 'open-new-tab'>('copy-link')
  const [shareState, setShareState] = useState<'idle' | 'copied-link' | 'copied-article' | 'failed'>('idle')
  const [sharePassword, setSharePassword] = useState('')
  const [shareStreamEnabled, setShareStreamEnabled] = useState(true)
  const shareResetTimerRef = useRef<number | null>(null)
  const shareMenuRef = useRef<HTMLDivElement>(null)
  const leftPaneEntries = useMemo(() => buildKeyboardNavEntries(treeItems), [treeItems])
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
  const orderedPostsByTree = useMemo(() => {
    const postByHashid = new Map(posts.map((post) => [post.hashid, post] as const))
    return leftPaneEntries
      .filter((entry) => entry.type === 'file' && entry.hashid)
      .map((entry) => postByHashid.get(entry.hashid!))
      .filter((item): item is BlogPostMeta => Boolean(item))
  }, [leftPaneEntries, posts])

  const currentPostIndex = activePost
    ? orderedPostsByTree.findIndex((item) => item.hashid === activePost.meta.hashid)
    : -1
  const prevPost = currentPostIndex > 0 ? orderedPostsByTree[currentPostIndex - 1] : undefined
  const nextPost =
    currentPostIndex >= 0 && currentPostIndex < orderedPostsByTree.length - 1
      ? orderedPostsByTree[currentPostIndex + 1]
      : undefined
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

  const resetShareStateTimer = (nextState: 'copied-link' | 'copied-article' | 'failed') => {
    if (shareResetTimerRef.current !== null) {
      window.clearTimeout(shareResetTimerRef.current)
      shareResetTimerRef.current = null
    }
    setShareState(nextState)
    shareResetTimerRef.current = window.setTimeout(() => setShareState('idle'), nextState === 'failed' ? 1600 : 1200)
  }

  const buildShareUrl = (shareToken: string) => {
    const url = new URL(`/s/${shareToken}`, window.location.origin)
    url.searchParams.set('stream', shareStreamEnabled ? '1' : '0')
    return url.toString()
  }

  const shareCurrent = async () => {
    if (!currentHashid) return

    const shareToken = encodeShareToken(currentHashid, sharePassword)
    if (!shareToken) {
      resetShareStateTimer('failed')
      return
    }

    const shareUrl = buildShareUrl(shareToken)
    const ok = await copyTextToClipboard(shareUrl)
    resetShareStateTimer(ok ? 'copied-link' : 'failed')
  }

  const configureSharePassword = () => {
    const nextValue = window.prompt('设置分享密码（留空表示不加密）', sharePassword)
    if (nextValue === null) return
    setSharePassword(nextValue.trim())
    setShareMenuOpen(false)
  }

  const copyCurrentArticle = async () => {
    if (!activePost) return

    const lines: string[] = []
    if (activePost.meta.title) lines.push(`# ${activePost.meta.title}`)
    if (activePost.meta.date) lines.push('', `> ${activePost.meta.date}`)
    const content = activePost.content.trim()
    if (content) lines.push('', content)
    const text = lines.join('\n').trim()
    const ok = await copyTextToClipboard(text || activePost.meta.title || '')
    resetShareStateTimer(ok ? 'copied-article' : 'failed')
  }

  const downloadCurrentArticle = () => {
    if (!activePost || typeof window === 'undefined') return

    const lines: string[] = []
    if (activePost.meta.title) lines.push(`# ${activePost.meta.title}`)
    if (activePost.meta.date) lines.push('', `> ${activePost.meta.date}`)
    const content = activePost.content.trim()
    if (content) lines.push('', content)
    const text = lines.join('\n').trim() || activePost.content || ''

    const filenameBase = (activePost.meta.title?.trim() || activePost.meta.hashid || 'article')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${filenameBase || 'article'}.md`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0)
  }

  const openCurrentInNewTab = () => {
    if (!currentHashid || typeof window === 'undefined') return
    const shareToken = encodeShareToken(currentHashid, sharePassword)
    if (!shareToken) {
      resetShareStateTimer('failed')
      return
    }
    const targetUrl = buildShareUrl(shareToken)
    const anchor = document.createElement('a')
    anchor.href = targetUrl
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)

    // fallback for environments where synthetic anchor click is blocked
    if (document.visibilityState === 'visible') {
      window.open(targetUrl, '_blank')
    }
  }

  const runShareAction = async () => {
    if (shareAction === 'open-new-tab') {
      openCurrentInNewTab()
      return
    }
    if (shareAction === 'copy-link') {
      await shareCurrent()
      return
    }
    if (shareAction === 'copy-article') {
      await copyCurrentArticle()
      return
    }
    downloadCurrentArticle()
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
    return () => {
      if (shareResetTimerRef.current !== null) {
        window.clearTimeout(shareResetTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!shareMenuOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!shareMenuRef.current?.contains(event.target as Node)) {
        setShareMenuOpen(false)
      }
    }
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShareMenuOpen(false)
    }
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [shareMenuOpen])

  useEffect(() => {
    if (!currentHashid) return
    setFocusedHashid(currentHashid)
    const currentItem = treeItems.find((item) => item.hashid === currentHashid)
    if (currentItem) setFocusedTreePath(currentItem.treePath)
  }, [currentHashid, treeItems])

  useEffect(() => {
    if (!currentHashid) return

    // Route param changes can reuse the same view; reset scroll to avoid mid-page leftovers on mobile.
    const container = mainScrollRef.current
    if (container) {
      container.scrollTo({ top: 0, behavior: 'auto' })
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [currentHashid])

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
          className={cn('mobile-tree-drawer xl:hidden', mobileTreeOpen && 'mobile-tree-drawer-open')}
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
              aria-label="关闭目录"
              className="absolute right-3 bottom-3 inline-flex size-8 items-center justify-center rounded border border-border bg-card/95 text-foreground/80 shadow-sm backdrop-blur hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5 shrink-0" />
              <span className="sr-only">关闭目录</span>
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'main-grid',
          sidebarsHidden && 'main-grid-focus-mode',
        )}
        style={mainGridStyle}
      >
        <div className={cn('blog-side-panel', sidebarsHidden && 'blog-side-panel-focus', activePane === 'left' && !sidebarsHidden && 'pane-focused')}>
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

        <div className={cn('blog-content-columns', (!showToc || sidebarsHidden) && 'blog-content-columns-no-toc')}>
        <section
          className="blog-col-main"
          ref={(node) => {
            mainScrollRef.current = node
          }}
        >
          {activePost ? (
            <div
              className={cn(
                'relative z-20 mb-4 flex flex-col items-start gap-3 border-b border-border px-5 py-[5.4px] sm:-mx-5 sm:-mt-5 sm:sticky sm:top-0 sm:flex-row sm:justify-between xl:-mx-6 xl:px-6',
                !activePost.meta.title && 'hidden sm:flex',
              )}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 sm:bg-[color-mix(in_srgb,var(--color-secondary)_88%,transparent)] sm:backdrop-blur-md sm:backdrop-saturate-150 sm:supports-backdrop-filter:bg-[color-mix(in_srgb,var(--color-secondary)_70%,transparent)]"
              />
              <div className="relative z-10 flex w-full flex-col items-start gap-3 sm:flex-row sm:justify-between">
                {activePost.meta.title ? (
                  <h1 className="m-0 flex-1 text-xl leading-[1.2] font-semibold tracking-tight text-foreground xl:text-2xl">
                    {activePost.meta.title}
                  </h1>
                ) : null}
                {currentHashid ? (
                  <div ref={shareMenuRef} className="relative self-end hidden sm:ml-auto sm:block sm:self-auto">
                    <div className="inline-flex overflow-hidden rounded border border-border bg-card text-sm text-foreground">
                      <button
                        type="button"
                        onClick={runShareAction}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 hover:bg-muted"
                      >
                        {shareState === 'copied-link' || shareState === 'copied-article' ? (
                          <Check className="size-4 shrink-0" />
                        ) : shareAction === 'open-new-tab' ? (
                          <ExternalLink className="size-4 shrink-0" />
                        ) : shareAction === 'download-md' ? (
                          <Download className="size-4 shrink-0" />
                        ) : (
                          <Copy className="size-4 shrink-0" />
                        )}
                        <span>
                          {shareState === 'copied-link'
                            ? '已复制链接'
                            : shareState === 'copied-article'
                              ? '已复制文章'
                              : shareState === 'failed'
                                ? '复制失败'
                                : shareAction === 'copy-link'
                                  ? '复制分享链接'
                                  : shareAction === 'copy-article'
                                    ? '复制文章'
                                    : shareAction === 'open-new-tab'
                                      ? '新页面打开'
                                      : '下载 Markdown 文件'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShareMenuOpen((prev) => !prev)}
                        className="inline-flex items-center border-l border-border px-2 hover:bg-muted"
                        aria-haspopup="menu"
                        aria-expanded={shareMenuOpen}
                        aria-label="切换分享动作"
                      >
                        <ChevronDown className="size-4 shrink-0 opacity-80" />
                      </button>
                    </div>
                    {shareMenuOpen ? (
                      <div
                        role="menu"
                        className="absolute top-[calc(100%+6px)] right-0 z-20 min-w-[190px] rounded-md border border-border bg-popover p-1 shadow-lg"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShareAction('open-new-tab')
                            setShareMenuOpen(false)
                          }}
                          className="flex w-full items-center gap-1.5 rounded px-2.5 py-1.5 text-left text-sm whitespace-nowrap text-foreground hover:bg-muted"
                        >
                          <ExternalLink className="size-3.5 shrink-0" />
                          <span>新页面打开</span>
                          {shareAction === 'open-new-tab' ? (
                            <Check className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                          ) : null}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShareAction('copy-link')
                            setShareMenuOpen(false)
                          }}
                          className="flex w-full items-center gap-1.5 rounded px-2.5 py-1.5 text-left text-sm whitespace-nowrap text-foreground hover:bg-muted"
                        >
                          <Link2 className="size-3.5 shrink-0" />
                          <span>复制分享链接</span>
                          {shareAction === 'copy-link' ? (
                            <Check className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                          ) : null}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShareAction('copy-article')
                            setShareMenuOpen(false)
                          }}
                          className="flex w-full items-center gap-1.5 rounded px-2.5 py-1.5 text-left text-sm whitespace-nowrap text-foreground hover:bg-muted"
                        >
                          <FileText className="size-3.5 shrink-0" />
                          <span>复制文章</span>
                          {shareAction === 'copy-article' ? (
                            <Check className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                          ) : null}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShareAction('download-md')
                            setShareMenuOpen(false)
                          }}
                          className="flex w-full items-center gap-1.5 rounded px-2.5 py-1.5 text-left text-sm whitespace-nowrap text-foreground hover:bg-muted"
                        >
                          <Download className="size-3.5 shrink-0" />
                          <span>下载 Markdown 文件</span>
                          {shareAction === 'download-md' ? (
                            <Check className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                          ) : null}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => setShareStreamEnabled((prev) => !prev)}
                          className="flex w-full items-center gap-1.5 rounded px-2.5 py-1.5 text-left text-sm whitespace-nowrap text-foreground hover:bg-muted"
                        >
                          <ListTree className="size-3.5 shrink-0" />
                          <span>流式展示</span>
                          {shareStreamEnabled ? (
                            <Check className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                          ) : null}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={configureSharePassword}
                          className="flex w-full items-center gap-1.5 rounded px-2.5 py-1.5 text-left text-sm whitespace-nowrap text-foreground hover:bg-muted"
                        >
                          <Lock className="size-3.5 shrink-0" />
                          <span>{sharePassword ? '修改分享密码' : '设置分享密码'}</span>
                          {sharePassword ? (
                            <Check className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
                          ) : null}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="blog-main-inner">
            <div key={currentHashid ?? 'empty'} className="blog-content-fade-enter">
              {activePost ? (
                <>
                <header className="mb-6">
                  {activePost.meta.date ? (
                    <p className="mt-3 flex w-full items-center justify-end gap-1.5 text-[12px] text-muted-foreground">
                      <CalendarDays className="size-3.5 shrink-0" />
                      <time>{activePost.meta.date}</time>
                    </p>
                  ) : null}
                  {activePost.meta.description ? (
                    <p className="mt-4 inline-flex w-full items-start gap-2 rounded-md border border-border bg-muted px-3 py-2 text-[13px] leading-6 text-foreground/80">
                      <Quote className="mt-1 size-3 shrink-0 text-muted-foreground" />
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
                  <div className="rounded-lg border border-dashed border-border bg-muted/60 px-4 py-8 text-center text-sm text-muted-foreground">
                    <FileText className="mx-auto mb-2 size-5 text-muted-foreground" />
                    当前文章暂无正文内容，可以从左侧目录切换到其他文章。
                  </div>
                )}

                <nav className="mt-10 grid auto-rows-fr gap-3 border-t border-border pt-6 sm:grid-cols-2">
                  {prevPost ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          to: '/blog/$hashid',
                          params: { hashid: prevPost.hashid },
                        })
                      }
                      className="flex h-full cursor-pointer flex-col rounded-lg border border-border bg-card px-4 py-3 text-left text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <span className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowLeft className="size-3.5 shrink-0" />
                        <span>上一篇</span>
                      </span>
                      <span className="line-clamp-2 block">{getPostDisplayTitle(prevPost)}</span>
                    </button>
                  ) : (
                    <div className="flex h-full flex-col rounded-lg border border-dashed border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                      <span className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowLeft className="size-3.5 shrink-0 opacity-80" />
                        <span>上一篇</span>
                      </span>
                      <span className="block text-muted-foreground">已经是最新一篇</span>
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
                      className="flex h-full cursor-pointer flex-col items-end rounded-lg border border-border bg-card px-4 py-3 text-right text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <span className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <span>下一篇</span>
                        <ArrowRight className="size-3.5 shrink-0" />
                      </span>
                      <span className="line-clamp-2 block">{getPostDisplayTitle(nextPost)}</span>
                    </button>
                  ) : (
                    <div className="flex h-full flex-col items-end rounded-lg border border-dashed border-border bg-muted/60 px-4 py-3 text-right text-sm text-muted-foreground">
                      <span className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <span>下一篇</span>
                        <ArrowRight className="size-3.5 shrink-0 opacity-80" />
                      </span>
                      <span className="block text-muted-foreground">已经是最后一篇</span>
                    </div>
                  )}
                </nav>
                </>
              ) : activeImage ? (
                <div className="space-y-4">
                <header>
                  <h1 className="m-0 text-[24px] leading-[1.2] font-semibold tracking-tight text-foreground">
                    {activeImage.meta.title}
                  </h1>
                  <p className="mt-3 text-[12px] text-muted-foreground">{activeImage.meta.sourcePath}</p>
                </header>
                <div className="overflow-hidden rounded-lg border border-border bg-background p-2">
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
                <SearchX className="size-9 text-muted-foreground" />
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">文章不存在</h1>
                <p className="text-sm text-muted-foreground">请从左侧目录选择其他文章继续预览</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {showToc && !sidebarsHidden ? (
          <aside
            className={cn(
              'blog-col-right blog-side-panel h-full max-h-dvh min-h-0 xl:flex! xl:flex-col',
              activePane === 'right' && 'pane-focused',
            )}
          >
            <p className="toc-panel-title flex w-full items-center gap-1.5">
              <ListTree className="size-4 shrink-0" />
              <span>本页目录</span>
            </p>
            <ul className="toc-list min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
      </div>
      <div className="fixed bottom-4 left-4 z-30 xl:hidden">
        <button
          type="button"
          onClick={openMobileTree}
          aria-label="打开目录树"
          className="inline-flex size-9 items-center justify-center rounded border border-border bg-card text-foreground shadow-sm hover:bg-muted"
        >
          <PanelLeftOpen className="size-4 shrink-0" />
          <span className="sr-only">打开目录树</span>
        </button>
      </div>
    </main>
  )
}
