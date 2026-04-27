import { Link } from '@tanstack/react-router'
import { ChevronRight, FileCode2, FileText, Folder, FolderOpen } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

type BlogFileTreeProps = {
  items: Array<{
    hashid: string
    treePath: string
    sourcePath: string
  }>
  currentHashid?: string
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

function buildTree(items: Array<{ hashid: string; treePath: string; sourcePath: string }>) {
  const root = createNode('blog')

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

function NodeItem({
  node,
  currentHashid,
  defaultOpenPaths,
  path = '',
}: {
  node: TreeNode
  currentHashid?: string
  defaultOpenPaths: Set<string>
  path?: string
}) {
  const isFile = Boolean(node.hashid)
  const children = Array.from(node.children.values()).sort((a, b) => {
    if (a.hashid && !b.hashid) return 1
    if (!a.hashid && b.hashid) return -1
    return a.name.localeCompare(b.name)
  })

  const nodePath = path ? `${path}/${node.name}` : node.name
  const initialOpen = defaultOpenPaths.has(nodePath)

  if (isFile && node.hashid) {
    const isActive = currentHashid === node.hashid
    const FileIcon = node.extension === 'md' ? FileCode2 : FileText
    return (
      <li>
        <Link
          to="/blog/$hashid"
          params={{ hashid: node.hashid }}
          className={cn(
            'explorer-row',
            isActive ? 'explorer-row-active font-medium' : 'explorer-row-muted',
          )}
        >
          <FileIcon className="size-4 shrink-0" />
          <span className="truncate">{toLabel(node.name)}</span>
        </Link>
      </li>
    )
  }

  const [open, setOpen] = useState(Boolean(initialOpen))

  useEffect(() => {
    if (initialOpen) {
      setOpen(true)
    }
  }, [initialOpen])

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="explorer-row explorer-row-muted group w-full text-left"
      >
        <ChevronRight
          className={cn('size-4 shrink-0 transition-transform', open && 'rotate-90')}
        />
        {open ? (
          <FolderOpen className="size-4 shrink-0" />
        ) : (
          <Folder className="size-4 shrink-0" />
        )}
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
                path={nodePath}
                defaultOpenPaths={defaultOpenPaths}
              />
            ))}
          </ul>
        </>
      )}
    </li>
  )
}

export default function BlogFileTree({ items, currentHashid }: BlogFileTreeProps) {
  const tree = useMemo(() => buildTree(items), [items])
  const current = items.find((item) => item.hashid === currentHashid)
  const defaultOpenPaths = new Set(collectParentPaths(current?.treePath))
  const topLevelNodes = Array.from(tree.children.values()).sort((a, b) => {
    if (a.hashid && !b.hashid) return 1
    if (!a.hashid && b.hashid) return -1
    return a.name.localeCompare(b.name)
  })

  return (
    <aside>
      <p className="explorer-heading">博客目录</p>
      <ul className="explorer-tree-list">
        {topLevelNodes.map((node) => (
          <NodeItem
            key={node.name}
            node={node}
            currentHashid={currentHashid}
            path=""
            defaultOpenPaths={defaultOpenPaths}
          />
        ))}
      </ul>
    </aside>
  )
}
