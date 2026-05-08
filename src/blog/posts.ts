import { blogContentConfig } from './config'

export type BlogPostMeta = {
  title?: string
  date: string
  description?: string
  /** Resolved URL: bundled asset path, site-absolute `/…`, or full `https://…`. */
  image?: string
  hashid: string
  treePath: string
  sourcePath: string
}

export type BlogPost = {
  meta: BlogPostMeta
  content: string
  /** Dev only: full `.md` file (frontmatter + body) for editing in the browser */
  raw?: string
}

export type BlogTreeItem = {
  hashid: string
  treePath: string
  sourcePath: string
}

type FrontmatterParseResult = {
  data: Record<string, unknown>
  content: string
}

function parseFrontmatterValue(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const quotedMatch = trimmed.match(/^(['"])([\s\S]*)\1$/)
  if (quotedMatch) return quotedMatch[2]

  return trimmed
}

function parseFrontmatterObject(frontmatterSource: string): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const lines = frontmatterSource.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf(':')
    if (separator <= 0) continue

    const key = trimmed.slice(0, separator).trim()
    const valueSource = trimmed.slice(separator + 1)
    if (!key) continue

    data[key] = parseFrontmatterValue(valueSource)
  }

  return data
}

function toRelativeContentPath(path: string) {
  const normalized = path.replace(/\\/g, '/')
  const marker = `/${blogContentConfig.contentDirName}/`
  const idx = normalized.lastIndexOf(marker)
  if (idx === -1) {
    const escapedDirName = blogContentConfig.contentDirName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const relativeMatch = normalized.match(new RegExp(`(?:^|/)${escapedDirName}/(.+)$`))
    if (relativeMatch?.[1]) return relativeMatch[1]
    return normalized
  }
  return normalized.slice(idx + marker.length)
}

function toBlogTreePath(relativeContentPath: string, options?: { stripMarkdownExt?: boolean }) {
  if (options?.stripMarkdownExt) return relativeContentPath.replace(/\.md$/, '')
  return relativeContentPath
}

function fnv1aHash(input: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function createHashIdFromPath(path: string) {
  return fnv1aHash(path).toString(36)
}

const ENTRY_SOURCE_PATH = 'index.md'

function isEntryItem(sourcePath: string) {
  return sourcePath === ENTRY_SOURCE_PATH
}

function compareByDateDesc(a: BlogPostMeta, b: BlogPostMeta) {
  if (isEntryItem(a.sourcePath) !== isEntryItem(b.sourcePath)) {
    return isEntryItem(a.sourcePath) ? -1 : 1
  }

  const aTime = Date.parse(a.date)
  const bTime = Date.parse(b.date)
  if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
    const dateCompare = b.date.localeCompare(a.date)
    if (dateCompare !== 0) return dateCompare
    return a.treePath.localeCompare(b.treePath)
  }

  const timeCompare = bTime - aTime
  if (timeCompare !== 0) return timeCompare
  return a.treePath.localeCompare(b.treePath)
}

function parseFrontmatter(raw: string): FrontmatterParseResult {
  const normalized = raw.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    return { data: {}, content: normalized }
  }

  const end = normalized.indexOf('\n---\n', 4)
  if (end === -1) {
    return { data: {}, content: normalized }
  }

  const frontmatterSource = normalized.slice(4, end)
  const rest = normalized.slice(end + 5)
  const loaded = parseFrontmatterObject(frontmatterSource)

  return {
    data: loaded && typeof loaded === 'object' ? (loaded as Record<string, unknown>) : {},
    content: rest,
  }
}

/** Resolve ./foo.png or foo.png in markdown relative to the .md file under content/. */
function resolveMarkdownImageRef(mdSourcePath: string, ref: string): string | null {
  const trimmed = ref.trim()
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//') || trimmed.startsWith('data:'))
    return null
  if (trimmed.startsWith('/')) return null

  const baseDir = mdSourcePath.includes('/')
    ? mdSourcePath.slice(0, mdSourcePath.lastIndexOf('/'))
    : ''
  const pathPart = trimmed.replace(/^\.\//, '').split(/[#?]/)[0]
  if (!pathPart) return null
  const resolved = baseDir ? `${baseDir}/${pathPart}` : pathPart
  return resolved.replace(/\/{2,}/g, '/')
}

/** Frontmatter `image`: external URL, site-absolute path, or path relative to the markdown file. */
function resolveFrontmatterImageUrl(
  raw: string,
  mdSourcePath: string,
  urlBySourcePath: Map<string, string>,
): string | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')) return trimmed
  if (trimmed.startsWith('data:')) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  const resolved = resolveMarkdownImageRef(mdSourcePath, trimmed)
  if (!resolved) return undefined
  return urlBySourcePath.get(resolved)
}

/** Rewrite <img src="relative"> to Vite-resolved asset URLs (supports multiline tags). */
function rewriteHtmlImgSrcUrls(
  markdown: string,
  mdSourcePath: string,
  urlBySourcePath: Map<string, string>,
): string {
  return markdown.replace(/<img\b[\s\S]*?>/gi, (tag) =>
    tag.replace(/\bsrc\s*=\s*(["'])([^"']*)\1/i, (whole, quote: string, rawUrl: string) => {
      const resolved = resolveMarkdownImageRef(mdSourcePath, rawUrl)
      if (!resolved) return whole
      const built = urlBySourcePath.get(resolved)
      if (!built) return whole
      return `src=${quote}${built}${quote}`
    }),
  )
}

/** Rewrite ![](relative) and HTML <img src="relative"> to Vite-resolved asset URLs for files under content/. */
function rewriteLocalImageUrls(
  markdown: string,
  mdSourcePath: string,
  urlBySourcePath: Map<string, string>,
): string {
  const afterMd = markdown.replace(/!\[([^\]]*)\]\(\s*([^)]+)\s*\)/g, (whole, alt, inner) => {
    const trimmed = inner.trim()
    const quotedTitle = trimmed.match(/^(\S+)\s+["']([^"']*)["']\s*$/)
    const rawUrl = quotedTitle?.[1] ?? trimmed.split(/\s+/)[0]
    const title = quotedTitle?.[2]
    const resolved = resolveMarkdownImageRef(mdSourcePath, rawUrl)
    if (!resolved) return whole
    const built = urlBySourcePath.get(resolved)
    if (!built) return whole
    const titleSuffix = title !== undefined ? ` "${title.replace(/"/g, '\\"')}"` : ''
    return `![${alt}](${built}${titleSuffix})`
  })
  return rewriteHtmlImgSrcUrls(afterMd, mdSourcePath, urlBySourcePath)
}

// Vite requires literal patterns in import.meta.glob.
const rawPosts = import.meta.glob('../../content/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const rawImages = import.meta.glob('../../content/**/*.{png,jpg,jpeg,gif,webp,avif,svg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const imageUrlBySourcePath = new Map<string, string>()
for (const [path, imageUrl] of Object.entries(rawImages)) {
  imageUrlBySourcePath.set(toRelativeContentPath(path), imageUrl)
}

const parsedPosts = Object.entries(rawPosts).map(([path, raw]) => {
  const relativeContentPath = toRelativeContentPath(path)

  const fm = parseFrontmatter(raw)
  const treePath = toBlogTreePath(relativeContentPath, { stripMarkdownExt: true })
  const hashid = createHashIdFromPath(relativeContentPath)

  const title =
    typeof fm.data?.title === 'string' && fm.data.title.trim()
      ? fm.data.title.trim()
      : undefined

  const date =
    typeof fm.data?.date === 'string' && fm.data.date.trim()
      ? fm.data.date.trim()
      : ''

  const description =
    typeof fm.data?.description === 'string' && fm.data.description.trim()
      ? fm.data.description.trim()
      : undefined

  const imageRaw =
    typeof fm.data?.image === 'string' && fm.data.image.trim() ? fm.data.image.trim() : undefined
  const image = imageRaw
    ? resolveFrontmatterImageUrl(imageRaw, relativeContentPath, imageUrlBySourcePath)
    : undefined

  const meta: BlogPostMeta = {
    title,
    date,
    description,
    ...(image ? { image } : {}),
    hashid,
    treePath,
    sourcePath: relativeContentPath,
  }
  const content = rewriteLocalImageUrls(fm.content.trim(), relativeContentPath, imageUrlBySourcePath)

  return {
    meta,
    content,
    ...(import.meta.env.DEV ? { raw } : {}),
  } satisfies BlogPost
}).filter((item): item is BlogPost => Boolean(item))

export const allPosts: BlogPostMeta[] = parsedPosts.map((p) => p.meta).sort(compareByDateDesc)

export const allTreeItems: BlogTreeItem[] = [...parsedPosts.map((p) => p.meta)]
  .sort((a, b) => {
    if (isEntryItem(a.sourcePath) !== isEntryItem(b.sourcePath)) {
      return isEntryItem(a.sourcePath) ? -1 : 1
    }
    return a.treePath.localeCompare(b.treePath)
  })
  .map((item) => ({
    hashid: item.hashid,
    treePath: item.treePath,
    sourcePath: item.sourcePath,
  }))

export function getPostByHashid(hashid: string): BlogPost | undefined {
  return parsedPosts.find((p) => p.meta.hashid === hashid)
}

