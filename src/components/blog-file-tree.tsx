import * as ContextMenu from '@radix-ui/react-context-menu'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Monitor, Pencil, Sparkles, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { blogUiConfig } from '@/blog/config'
import { withBaseUrl } from '@/lib/base-url'
import type { BlogDevSourceSearch } from '@/lib/blog-dev-source-search'
import { cn } from '@/lib/utils'
import type { BlogFileTreeDevFsContext } from './blog-file-tree-types'

export type { BlogFileTreeDevFsContext } from './blog-file-tree-types'

type BlogFileTreeProps = {
  items: Array<{
    hashid: string
    treePath: string
    sourcePath: string
  }>
  currentHashid?: string
  focusedHashid?: string
  focusedTreePath?: string
  toggleDirectoryRequest?: {
    path: string
    nonce: number
  }
  onOpenPathsChange?: (paths: string[]) => void
  onSelectFile?: () => void
  linkSearch?: BlogDevSourceSearch
  devFsEnabled?: boolean
  onDevFsCreateMarkdown?: (parentRelativeDir: string) => void | Promise<void>
  onDevFsCreateFolder?: (parentRelativeDir: string) => void | Promise<void>
  onDevFsRename?: (ctx: BlogFileTreeDevFsContext) => void | Promise<void>
  onDevFsDelete?: (ctx: BlogFileTreeDevFsContext) => void | Promise<void>
  onDevFsMove?: (from: BlogFileTreeDevFsContext, toParentRelativeDir: string) => void | Promise<void>
}

type TreeNode = {
  name: string
  hashid?: string
  children: Map<string, TreeNode>
}

function createNode(name: string): TreeNode {
  return { name, children: new Map() }
}

function buildTree(items: Array<{ hashid: string; treePath: string; sourcePath: string }>) {
  const root = createNode('')

  for (const item of items) {
    const parts = item.treePath.split('/').filter(Boolean)
    let cursor = root

    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const key = isFile ? `${part}__file` : `${part}__dir`
      let next = cursor.children.get(key)
      if (!next) {
        next = createNode(part)
        cursor.children.set(key, next)
      }
      if (isFile) {
        next.hashid = item.hashid
      }
      cursor = next
    }
  }

  const collapseDirectoryChains = (node: TreeNode): TreeNode => {
    if (node.children.size > 0) {
      const collapsedChildren = new Map<string, TreeNode>()
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
      node.children = onlyChild.children
    }

    return node
  }

  if (root.children.size > 0) {
    const collapsedRootChildren = new Map<string, TreeNode>()
    for (const child of root.children.values()) {
      const collapsed = collapseDirectoryChains(child)
      const key = collapsed.hashid ? `${collapsed.name}__file` : `${collapsed.name}__dir`
      collapsedRootChildren.set(key, collapsed)
    }
    root.children = collapsedRootChildren
  }

  return root
}

function collectParentPaths(slug?: string) {
  if (!slug) return []
  const parts = slug.split('/').filter(Boolean)
  const paths: string[] = []
  let acc = ''
  for (let i = 0; i < parts.length - 1; i += 1) {
    acc = acc ? `${acc}/${parts[i]}` : parts[i]
    paths.push(acc)
  }
  return paths
}

function toLabel(name: string) {
  return name.replace(/[-_]/g, ' ')
}

function compareTreeNodes(a: TreeNode, b: TreeNode) {
  const aIsIndex = a.name.toLowerCase() === 'index'
  const bIsIndex = b.name.toLowerCase() === 'index'
  if (aIsIndex && !bIsIndex) return -1
  if (!aIsIndex && bIsIndex) return 1

  if (a.hashid && !b.hashid) return 1
  if (!a.hashid && b.hashid) return -1
  return a.name.localeCompare(b.name)
}

function parentDirOfTreePath(treePath: string) {
  const parts = treePath.split('/').filter(Boolean)
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
}

type DropHighlightData = { toParentRelativeDir: string }

function dragPayloadFromActiveData(data: unknown): BlogFileTreeDevFsContext | null {
  if (!data || typeof data !== 'object') return null
  const fs = (data as { fs?: BlogFileTreeDevFsContext }).fs
  return fs ?? null
}

function ExplorerFsContextMenu({
  enabled,
  fsCtx,
  onCreateMarkdown,
  onCreateFolder,
  onRename,
  onDelete,
  children,
}: {
  enabled: boolean
  fsCtx: BlogFileTreeDevFsContext
  onCreateMarkdown?: (parentRelativeDir: string) => void | Promise<void>
  onCreateFolder?: (parentRelativeDir: string) => void | Promise<void>
  onRename?: () => void
  onDelete?: () => void
  children: React.ReactNode
}) {
  if (!enabled) return <>{children}</>

  const parent =
    fsCtx.kind === 'file' ? parentDirOfTreePath(fsCtx.treePath) : fsCtx.treePath

  const showCreate = Boolean(onCreateMarkdown || onCreateFolder)
  const showEdit = Boolean(onRename || onDelete)

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="blog-fs-ctx-menu" collisionPadding={12}>
          {onCreateMarkdown ? (
            <ContextMenu.Item
              className="blog-fs-ctx-menu-item"
              onSelect={() => void onCreateMarkdown(parent)}
            >
              <img src={withBaseUrl('/file_type_markdown.svg')} alt="" className="size-4" width={16} height={16} />
              <span>新建 Markdown</span>
            </ContextMenu.Item>
          ) : null}
          {onCreateFolder ? (
            <ContextMenu.Item
              className="blog-fs-ctx-menu-item"
              onSelect={() => void onCreateFolder(parent)}
            >
              <img src={withBaseUrl('/default_folder.svg')} alt="" className="size-4" width={16} height={16} />
              <span>新建文件夹</span>
            </ContextMenu.Item>
          ) : null}
          {showCreate && showEdit ? <ContextMenu.Separator className="blog-fs-ctx-menu-sep" /> : null}
          {onRename ? (
            <ContextMenu.Item className="blog-fs-ctx-menu-item" onSelect={() => void onRename()}>
              <Pencil className="size-3.5 shrink-0 text-[#8fb3ff]" aria-hidden="true" />
              <span>重命名</span>
            </ContextMenu.Item>
          ) : null}
          {onDelete ? (
            <ContextMenu.Item
              className="blog-fs-ctx-menu-item blog-fs-ctx-menu-item-danger"
              onSelect={() => void onDelete()}
            >
              <Trash2 className="size-3.5 shrink-0 text-rose-400" aria-hidden="true" />
              <span>删除</span>
            </ContextMenu.Item>
          ) : null}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

function NodeItemPlain({
  node,
  currentHashid,
  focusedHashid,
  focusedTreePath,
  openPaths,
  setOpenPaths,
  onSelectFile,
  linkSearch,
  path = '',
  devFsEnabled,
  ctxMenuEnabled,
  sourcePathByHashid,
  onDevFsCreateMarkdown,
  onDevFsCreateFolder,
  onDevFsRename,
  onDevFsDelete,
}: {
  node: TreeNode
  currentHashid?: string
  focusedHashid?: string
  focusedTreePath?: string
  openPaths: Set<string>
  setOpenPaths: Dispatch<SetStateAction<Set<string>>>
  onSelectFile?: () => void
  linkSearch?: BlogDevSourceSearch
  path?: string
  devFsEnabled?: boolean
  ctxMenuEnabled: boolean
  sourcePathByHashid: Map<string, string>
  onDevFsCreateMarkdown?: (parentRelativeDir: string) => void | Promise<void>
  onDevFsCreateFolder?: (parentRelativeDir: string) => void | Promise<void>
  onDevFsRename?: (ctx: BlogFileTreeDevFsContext) => void | Promise<void>
  onDevFsDelete?: (ctx: BlogFileTreeDevFsContext) => void | Promise<void>
}) {
  const isFile = Boolean(node.hashid)
  const children = Array.from(node.children.values()).sort(compareTreeNodes)
  const nodePath = path ? `${path}/${node.name}` : node.name
  const isFocusedPath = focusedTreePath === nodePath

  if (isFile && node.hashid) {
    const isActive = currentHashid === node.hashid
    const isFocused = focusedHashid === node.hashid
    const sourcePath = sourcePathByHashid.get(node.hashid) ?? ''
    const fsCtx: BlogFileTreeDevFsContext = { kind: 'file', sourcePath, treePath: nodePath }
    const link = (
      <Link
        to="/blog/$hashid"
        params={{ hashid: node.hashid }}
        search={linkSearch}
        onClick={onSelectFile}
        className={cn(
          'explorer-row',
          isActive ? 'explorer-row-active font-medium' : 'explorer-row-muted',
          isFocused && !isActive && 'explorer-row-focused',
          isFocusedPath && !isActive && 'explorer-row-focused',
        )}
      >
        <img
          src={withBaseUrl('/file_type_markdown.svg')}
          alt=""
          aria-hidden="true"
          className="size-4 shrink-0"
          loading="lazy"
          decoding="async"
        />
        <span className="truncate">{toLabel(node.name)}</span>
      </Link>
    )
    return (
      <li>
        <ExplorerFsContextMenu
          enabled={Boolean(devFsEnabled && ctxMenuEnabled && sourcePath)}
          fsCtx={fsCtx}
          onCreateMarkdown={onDevFsCreateMarkdown}
          onCreateFolder={onDevFsCreateFolder}
          onRename={onDevFsRename ? () => void onDevFsRename(fsCtx) : undefined}
          onDelete={onDevFsDelete ? () => void onDevFsDelete(fsCtx) : undefined}
        >
          {link}
        </ExplorerFsContextMenu>
      </li>
    )
  }

  const open = openPaths.has(nodePath)
  const fsCtx: BlogFileTreeDevFsContext = { kind: 'dir', treePath: nodePath }
  const folderBtn = (
    <button
      type="button"
      onClick={() =>
        setOpenPaths((prev) => {
          const next = new Set(prev)
          if (next.has(nodePath)) next.delete(nodePath)
          else next.add(nodePath)
          return next
        })
      }
      className={cn(
        'explorer-row explorer-row-muted group w-full text-left',
        isFocusedPath && 'explorer-row-focused',
      )}
    >
      <ChevronRight className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')} />
      <img
        src={open ? withBaseUrl('/default_folder_opened.svg') : withBaseUrl('/default_folder.svg')}
        alt=""
        aria-hidden="true"
        className="size-4 shrink-0"
        loading="lazy"
        decoding="async"
      />
      <span className="truncate">{toLabel(node.name)}</span>
    </button>
  )

  return (
    <li>
      <ExplorerFsContextMenu
        enabled={Boolean(devFsEnabled && ctxMenuEnabled)}
        fsCtx={fsCtx}
        onCreateMarkdown={onDevFsCreateMarkdown}
        onCreateFolder={onDevFsCreateFolder}
        onRename={onDevFsRename ? () => void onDevFsRename(fsCtx) : undefined}
        onDelete={onDevFsDelete ? () => void onDevFsDelete(fsCtx) : undefined}
      >
        {folderBtn}
      </ExplorerFsContextMenu>
      {open && (
        <ul className="mt-1 ml-4 space-y-0 border-l border-[#2f3750] pl-2">
          {children.map((child) => (
            <NodeItemPlain
              key={`${nodePath}/${child.name}`}
              node={child}
              currentHashid={currentHashid}
              focusedHashid={focusedHashid}
              focusedTreePath={focusedTreePath}
              path={nodePath}
              openPaths={openPaths}
              setOpenPaths={setOpenPaths}
              onSelectFile={onSelectFile}
              linkSearch={linkSearch}
              devFsEnabled={devFsEnabled}
              ctxMenuEnabled={ctxMenuEnabled}
              sourcePathByHashid={sourcePathByHashid}
              onDevFsCreateMarkdown={onDevFsCreateMarkdown}
              onDevFsCreateFolder={onDevFsCreateFolder}
              onDevFsRename={onDevFsRename}
              onDevFsDelete={onDevFsDelete}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function NodeItemDnd({
  node,
  currentHashid,
  focusedHashid,
  focusedTreePath,
  openPaths,
  setOpenPaths,
  onSelectFile,
  linkSearch,
  path = '',
  devFsEnabled,
  ctxMenuEnabled,
  sourcePathByHashid,
  highlightDropParent,
  onDevFsCreateMarkdown,
  onDevFsCreateFolder,
  onDevFsRename,
  onDevFsDelete,
}: {
  node: TreeNode
  currentHashid?: string
  focusedHashid?: string
  focusedTreePath?: string
  openPaths: Set<string>
  setOpenPaths: Dispatch<SetStateAction<Set<string>>>
  onSelectFile?: () => void
  linkSearch?: BlogDevSourceSearch
  path?: string
  devFsEnabled?: boolean
  ctxMenuEnabled: boolean
  sourcePathByHashid: Map<string, string>
  highlightDropParent: string | null
  onDevFsCreateMarkdown?: (parentRelativeDir: string) => void | Promise<void>
  onDevFsCreateFolder?: (parentRelativeDir: string) => void | Promise<void>
  onDevFsRename?: (ctx: BlogFileTreeDevFsContext) => void | Promise<void>
  onDevFsDelete?: (ctx: BlogFileTreeDevFsContext) => void | Promise<void>
}) {
  const isFile = Boolean(node.hashid)
  const children = Array.from(node.children.values()).sort(compareTreeNodes)
  const nodePath = path ? `${path}/${node.name}` : node.name
  const isFocusedPath = focusedTreePath === nodePath

  if (isFile && node.hashid) {
    const isActive = currentHashid === node.hashid
    const isFocused = focusedHashid === node.hashid
    const sourcePath = sourcePathByHashid.get(node.hashid) ?? ''
    const fsCtx: BlogFileTreeDevFsContext = { kind: 'file', sourcePath, treePath: nodePath }
    const parentDir = parentDirOfTreePath(nodePath)

    const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
      id: `drag-file:${encodeURIComponent(sourcePath)}`,
      data: { fs: fsCtx },
      disabled: !sourcePath,
    })

    const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
      id: `drop-file-parent:${encodeURIComponent(nodePath)}`,
      data: { toParentRelativeDir: parentDir } satisfies DropHighlightData,
    })

    const dropHighlight =
      Boolean(isDropOver) || (highlightDropParent !== null && highlightDropParent === parentDir)

    const row = (
      <div
        ref={(el) => {
          setDropRef(el)
          setDragRef(el)
        }}
        {...attributes}
        {...listeners}
        className={cn(
          'explorer-row flex touch-none cursor-grab active:cursor-grabbing',
          isActive ? 'explorer-row-active font-medium' : 'explorer-row-muted',
          isFocused && !isActive && 'explorer-row-focused',
          isFocusedPath && !isActive && 'explorer-row-focused',
          dropHighlight && 'explorer-row-drop-target',
          isDragging && 'opacity-60',
        )}
      >
        <Link
          to="/blog/$hashid"
          params={{ hashid: node.hashid }}
          search={linkSearch}
          onClick={onSelectFile}
          className="flex min-w-0 flex-1 items-center gap-2 no-underline"
        >
          <img
            src={withBaseUrl('/file_type_markdown.svg')}
            alt=""
            aria-hidden="true"
            className="size-4 shrink-0"
            loading="lazy"
            decoding="async"
          />
          <span className="truncate">{toLabel(node.name)}</span>
        </Link>
      </div>
    )

    return (
      <li>
        <ExplorerFsContextMenu
          enabled={Boolean(devFsEnabled && ctxMenuEnabled && sourcePath)}
          fsCtx={fsCtx}
          onCreateMarkdown={onDevFsCreateMarkdown}
          onCreateFolder={onDevFsCreateFolder}
          onRename={onDevFsRename ? () => void onDevFsRename(fsCtx) : undefined}
          onDelete={onDevFsDelete ? () => void onDevFsDelete(fsCtx) : undefined}
        >
          {row}
        </ExplorerFsContextMenu>
      </li>
    )
  }

  const open = openPaths.has(nodePath)
  const fsCtx: BlogFileTreeDevFsContext = { kind: 'dir', treePath: nodePath }

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `drag-dir:${encodeURIComponent(nodePath)}`,
    data: { fs: fsCtx },
  })

  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({
    id: `drop-folder:${encodeURIComponent(nodePath)}`,
    data: { toParentRelativeDir: nodePath } satisfies DropHighlightData,
  })

  const dropHighlight =
    Boolean(isDropOver) || (highlightDropParent !== null && highlightDropParent === nodePath)

  const folderBtn = (
    <div
      ref={(el) => {
        setDropRef(el)
        setDragRef(el)
      }}
      {...attributes}
      {...listeners}
      className={cn(
        'explorer-row explorer-row-muted group flex w-full cursor-grab touch-none text-left active:cursor-grabbing',
        isFocusedPath && 'explorer-row-focused',
        dropHighlight && 'explorer-row-drop-target',
        isDragging && 'opacity-60',
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() =>
          setOpenPaths((prev) => {
            const next = new Set(prev)
            if (next.has(nodePath)) next.delete(nodePath)
            else next.add(nodePath)
            return next
          })
        }
      >
        <ChevronRight className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')} />
        <img
          src={open ? withBaseUrl('/default_folder_opened.svg') : withBaseUrl('/default_folder.svg')}
          alt=""
          aria-hidden="true"
          className="size-4 shrink-0"
          loading="lazy"
          decoding="async"
        />
        <span className="truncate">{toLabel(node.name)}</span>
      </button>
    </div>
  )

  return (
    <li>
      <ExplorerFsContextMenu
        enabled={Boolean(devFsEnabled && ctxMenuEnabled)}
        fsCtx={fsCtx}
        onCreateMarkdown={onDevFsCreateMarkdown}
        onCreateFolder={onDevFsCreateFolder}
        onRename={onDevFsRename ? () => void onDevFsRename(fsCtx) : undefined}
        onDelete={onDevFsDelete ? () => void onDevFsDelete(fsCtx) : undefined}
      >
        {folderBtn}
      </ExplorerFsContextMenu>
      {open && (
        <ul className="mt-1 ml-4 space-y-0 border-l border-[#2f3750] pl-2">
          {children.map((child) => (
            <NodeItemDnd
              key={`${nodePath}/${child.name}`}
              node={child}
              currentHashid={currentHashid}
              focusedHashid={focusedHashid}
              focusedTreePath={focusedTreePath}
              path={nodePath}
              openPaths={openPaths}
              setOpenPaths={setOpenPaths}
              onSelectFile={onSelectFile}
              linkSearch={linkSearch}
              devFsEnabled={devFsEnabled}
              ctxMenuEnabled={ctxMenuEnabled}
              sourcePathByHashid={sourcePathByHashid}
              highlightDropParent={highlightDropParent}
              onDevFsCreateMarkdown={onDevFsCreateMarkdown}
              onDevFsCreateFolder={onDevFsCreateFolder}
              onDevFsRename={onDevFsRename}
              onDevFsDelete={onDevFsDelete}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function BlogFileTree({
  items,
  currentHashid,
  focusedHashid,
  focusedTreePath,
  toggleDirectoryRequest,
  onOpenPathsChange,
  onSelectFile,
  linkSearch,
  devFsEnabled = false,
  onDevFsCreateMarkdown,
  onDevFsCreateFolder,
  onDevFsRename,
  onDevFsDelete,
  onDevFsMove,
}: BlogFileTreeProps) {
  const tree = useMemo(() => buildTree(items), [items])
  const sourcePathByHashid = useMemo(() => new Map(items.map((i) => [i.hashid, i.sourcePath] as const)), [items])
  const current = items.find((item) => item.hashid === currentHashid)
  const defaultOpenPaths = new Set(collectParentPaths(current?.treePath))
  const [openPaths, setOpenPaths] = useState<Set<string>>(defaultOpenPaths)
  const [highlightDropParent, setHighlightDropParent] = useState<string | null>(null)
  const [dragOverlayLabel, setDragOverlayLabel] = useState<string | null>(null)

  const devFsDnd = Boolean(devFsEnabled && onDevFsMove)
  const ctxMenuEnabled = Boolean(
    onDevFsRename || onDevFsDelete || onDevFsCreateMarkdown || onDevFsCreateFolder,
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )

  useEffect(() => {
    setOpenPaths((prev) => {
      const next = new Set(prev)
      for (const path of defaultOpenPaths) next.add(path)
      return next
    })
  }, [currentHashid])

  useEffect(() => {
    if (!toggleDirectoryRequest) return
    const targetPath = toggleDirectoryRequest.path
    setOpenPaths((prev) => {
      const next = new Set(prev)
      if (next.has(targetPath)) next.delete(targetPath)
      else next.add(targetPath)
      return next
    })
  }, [toggleDirectoryRequest])

  useEffect(() => {
    onOpenPathsChange?.(Array.from(openPaths))
  }, [onOpenPathsChange, openPaths])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const raw = event.over?.data.current as DropHighlightData | undefined
    setHighlightDropParent(raw?.toParentRelativeDir ?? null)
  }, [])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const fs = dragPayloadFromActiveData(event.active.data.current)
    if (!fs) {
      setDragOverlayLabel(null)
      return
    }
    const label =
      fs.kind === 'file'
        ? fs.sourcePath.split('/').pop() ?? fs.sourcePath
        : fs.treePath.split('/').pop() ?? fs.treePath
    setDragOverlayLabel(label)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setHighlightDropParent(null)
      setDragOverlayLabel(null)
      const from = dragPayloadFromActiveData(event.active.data.current)
      const overData = event.over?.data.current as DropHighlightData | undefined
      const toParent = overData?.toParentRelativeDir
      if (!from || toParent === undefined || !onDevFsMove) return

      const normTo = toParent.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
      if (from.kind === 'dir') {
        const fromNorm = from.treePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
        if (normTo === fromNorm || normTo.startsWith(`${fromNorm}/`)) return
      }
      if (from.kind === 'file') {
        const parent = parentDirOfTreePath(from.treePath.replace(/\\/g, '/'))
        if (parent === normTo) return
      }
      await onDevFsMove(from, normTo)
    },
    [onDevFsMove],
  )

  const handleDragCancel = useCallback(() => {
    setHighlightDropParent(null)
    setDragOverlayLabel(null)
  }, [])

  const topLevelNodes = Array.from(tree.children.values()).sort(compareTreeNodes)

  const treeList = (
    <ul className="explorer-tree-list min-h-0 flex-1 overflow-y-auto">
      {topLevelNodes.map((node) =>
        devFsDnd ? (
          <NodeItemDnd
            key={node.name}
            node={node}
            currentHashid={currentHashid}
            focusedHashid={focusedHashid}
            focusedTreePath={focusedTreePath}
            path=""
            openPaths={openPaths}
            setOpenPaths={setOpenPaths}
            onSelectFile={onSelectFile}
            linkSearch={linkSearch}
            devFsEnabled={devFsEnabled}
            ctxMenuEnabled={ctxMenuEnabled}
            sourcePathByHashid={sourcePathByHashid}
            highlightDropParent={highlightDropParent}
            onDevFsCreateMarkdown={onDevFsCreateMarkdown}
            onDevFsCreateFolder={onDevFsCreateFolder}
            onDevFsRename={onDevFsRename}
            onDevFsDelete={onDevFsDelete}
          />
        ) : (
          <NodeItemPlain
            key={node.name}
            node={node}
            currentHashid={currentHashid}
            focusedHashid={focusedHashid}
            focusedTreePath={focusedTreePath}
            path=""
            openPaths={openPaths}
            setOpenPaths={setOpenPaths}
            onSelectFile={onSelectFile}
            linkSearch={linkSearch}
            devFsEnabled={devFsEnabled}
            ctxMenuEnabled={ctxMenuEnabled}
            sourcePathByHashid={sourcePathByHashid}
            onDevFsCreateMarkdown={onDevFsCreateMarkdown}
            onDevFsCreateFolder={onDevFsCreateFolder}
            onDevFsRename={onDevFsRename}
            onDevFsDelete={onDevFsDelete}
          />
        ),
      )}
    </ul>
  )

  return (
    <aside className="relative flex h-full max-h-dvh min-h-0 flex-col">
      <p className="explorer-heading flex w-full items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Monitor aria-hidden="true" className="size-4 shrink-0 text-sky-400" />
          <span>文件夹</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#3a4a73] bg-[#24314d] px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-[#c9d7fb]">
            <Sparkles aria-hidden="true" className="size-3 shrink-0 text-[#8fb3ff]" />
            <span>{blogUiConfig.explorerVersion}</span>
          </span>
        </span>
      </p>

      {devFsDnd ? (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={(e) => void handleDragEnd(e)}
          onDragCancel={handleDragCancel}
        >
          {treeList}
          <DragOverlay dropAnimation={{ duration: 160, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }}>
            {dragOverlayLabel ? (
              <div className="blog-fs-drag-overlay">
                <span className="truncate">{toLabel(dragOverlayLabel.replace(/\.md$/i, ''))}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <>
          {treeList}
        </>
      )}
    </aside>
  )
}
