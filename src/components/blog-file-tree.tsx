import { Link } from '@tanstack/react-router'
import {
  ChevronRight,
  Monitor,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { blogUiConfig } from '@/blog/config'
import { cn } from '@/lib/utils'

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
}

type TreeNode = {
  name: string
  hashid?: string
  extension?: string
  children: Map<string, TreeNode>
}

function createNode(name: string): TreeNode {
  return {
    name,
    children: new Map(),
  }
}

function getFileExtension(path: string) {
  const filename = path.split('/').pop() ?? path
  const match = filename.match(/\.([a-z0-9]+)$/i)
  return match ? match[1].toLowerCase() : undefined
}

function isImageExtension(extension?: string) {
  return Boolean(extension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'].includes(extension))
}

function getFileIconSrc(extension?: string) {
  if (isImageExtension(extension)) return '/file_type_image.svg'
  return '/file_type_markdown.svg'
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
        next.extension = getFileExtension(item.sourcePath)
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

function NodeItem({
  node,
  currentHashid,
  focusedHashid,
  focusedTreePath,
  openPaths,
  setOpenPaths,
  onSelectFile,
  path = '',
}: {
  node: TreeNode
  currentHashid?: string
  focusedHashid?: string
  focusedTreePath?: string
  openPaths: Set<string>
  setOpenPaths: Dispatch<SetStateAction<Set<string>>>
  onSelectFile?: () => void
  path?: string
}) {
  const isFile = Boolean(node.hashid)
  const children = Array.from(node.children.values()).sort(compareTreeNodes)

  const nodePath = path ? `${path}/${node.name}` : node.name
  const isFocusedPath = focusedTreePath === nodePath

  if (isFile && node.hashid) {
    const isActive = currentHashid === node.hashid
    const isFocused = focusedHashid === node.hashid
    return (
      <li>
        <Link
          to="/blog/$hashid"
          params={{ hashid: node.hashid }}
          onClick={onSelectFile}
          className={cn(
            'explorer-row',
            isActive ? 'explorer-row-active font-medium' : 'explorer-row-muted',
            isFocused && !isActive && 'explorer-row-focused',
            isFocusedPath && !isActive && 'explorer-row-focused',
          )}
        >
          <img
            src={getFileIconSrc(node.extension)}
            alt=""
            aria-hidden="true"
            className="size-4 shrink-0"
            loading="lazy"
            decoding="async"
          />
          <span className="truncate">{toLabel(node.name)}</span>
        </Link>
      </li>
    )
  }

  const open = openPaths.has(nodePath)

  return (
    <li>
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
        <ChevronRight
          className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')}
        />
        <img
          src={open ? '/default_folder_opened.svg' : '/default_folder.svg'}
          alt=""
          aria-hidden="true"
          className="size-4 shrink-0"
          loading="lazy"
          decoding="async"
        />
        <span className="truncate">{toLabel(node.name)}</span>
      </button>
      {open && (
        <>
          <ul className="mt-1 ml-4 space-y-0 border-l border-[#2f3750] pl-2">
            {children.map((child) => (
              <NodeItem
                key={`${nodePath}/${child.name}`}
                node={child}
                currentHashid={currentHashid}
                focusedHashid={focusedHashid}
                focusedTreePath={focusedTreePath}
                path={nodePath}
                openPaths={openPaths}
                setOpenPaths={setOpenPaths}
                onSelectFile={onSelectFile}
              />
            ))}
          </ul>
        </>
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
}: BlogFileTreeProps) {
  const tree = useMemo(() => buildTree(items), [items])
  const current = items.find((item) => item.hashid === currentHashid)
  const defaultOpenPaths = new Set(collectParentPaths(current?.treePath))
  const [openPaths, setOpenPaths] = useState<Set<string>>(defaultOpenPaths)

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
  const topLevelNodes = Array.from(tree.children.values()).sort(compareTreeNodes)

  return (
    <aside className="flex h-full max-h-dvh min-h-0 flex-col">
      <p className="explorer-heading flex w-full items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Monitor aria-hidden="true" className="size-4 shrink-0 text-sky-400" />
          <span>文件夹</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#3a4a73] bg-[#24314d] px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-[#c9d7fb]">
          <Sparkles aria-hidden="true" className="size-3 shrink-0 text-[#8fb3ff]" />
          <span>{blogUiConfig.explorerVersion}</span>
        </span>
      </p>
      <ul className="explorer-tree-list min-h-0 flex-1 overflow-y-auto">
        {topLevelNodes.map((node) => (
          <NodeItem
            key={node.name}
            node={node}
            currentHashid={currentHashid}
            focusedHashid={focusedHashid}
            focusedTreePath={focusedTreePath}
            path=""
            openPaths={openPaths}
            setOpenPaths={setOpenPaths}
            onSelectFile={onSelectFile}
          />
        ))}
      </ul>
    </aside>
  )
}
