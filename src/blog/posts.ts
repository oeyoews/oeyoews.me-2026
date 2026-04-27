import yaml from 'js-yaml'

export type BlogPostMeta = {
  title: string
  date: string
  description?: string
  hashid: string
  treePath: string
  sourcePath: string
}

export type BlogPost = {
  meta: BlogPostMeta
  content: string
}

type FrontmatterParseResult = {
  data: Record<string, unknown>
  content: string
}

function toRelativeContentPath(path: string) {
  const normalized = path.replace(/\\/g, '/')
  const marker = '/content/'
  const idx = normalized.lastIndexOf(marker)
  if (idx === -1) {
    const relativeMatch = normalized.match(/(?:^|\/)content\/(.+)$/)
    if (relativeMatch?.[1]) return relativeMatch[1]
    return normalized
  }
  return normalized.slice(idx + marker.length)
}

function toBlogTreePath(relativeContentPath: string) {
  return relativeContentPath.replace(/^blog\//, '').replace(/\.md$/, '')
}

function fnv1aHash(input: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function createHashIdFromTreePath(treePath: string) {
  return fnv1aHash(treePath).toString(36)
}

function compareByDateDesc(a: BlogPostMeta, b: BlogPostMeta) {
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
  const loaded = yaml.load(frontmatterSource)

  return {
    data: loaded && typeof loaded === 'object' ? (loaded as Record<string, unknown>) : {},
    content: rest,
  }
}

const rawPosts = import.meta.glob('../content/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const parsed = Object.entries(rawPosts).map(([path, raw]) => {
  const relativeContentPath = toRelativeContentPath(path)
  const isBlogPost = relativeContentPath.startsWith('blog/')

  if (!isBlogPost) return undefined

  const fm = parseFrontmatter(raw)
  const treePath = toBlogTreePath(relativeContentPath)
  const hashid = createHashIdFromTreePath(treePath)

  const title =
    typeof fm.data?.title === 'string' && fm.data.title.trim()
      ? fm.data.title.trim()
      : treePath

  const date =
    typeof fm.data?.date === 'string' && fm.data.date.trim()
      ? fm.data.date.trim()
      : '1970-01-01'

  const description =
    typeof fm.data?.description === 'string' && fm.data.description.trim()
      ? fm.data.description.trim()
      : undefined

  const meta: BlogPostMeta = {
    title,
    date,
    description,
    hashid,
    treePath,
    sourcePath: relativeContentPath,
  }
  const content = fm.content.trim()

  return { meta, content } satisfies BlogPost
}).filter((item): item is BlogPost => Boolean(item))

export const allPosts: BlogPostMeta[] = parsed
  .map((p) => p.meta)
  .sort(compareByDateDesc)

export function getPostByHashid(hashid: string): BlogPost | undefined {
  return parsed.find((p) => p.meta.hashid === hashid)
}

