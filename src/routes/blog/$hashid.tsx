import { createFileRoute, notFound } from '@tanstack/react-router'
import { allTreeItems, getImageByHashid, getPostByHashid } from '../../blog/posts'
import BlogListPage from '../../components/blog-list-page'

type TocItem = {
  level: 2 | 3
  text: string
  id: string
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

function extractToc(content: string): TocItem[] {
  const lines = content.split('\n')
  const items: TocItem[] = []
  const idCount = new Map<string, number>()

  const resolveUniqueId = (text: string) => {
    const base = toHeadingId(text)
    const count = idCount.get(base) ?? 0
    idCount.set(base, count + 1)
    return count === 0 ? base : `${base}-${count}`
  }

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/)
    if (h2) {
      const text = h2[1].trim()
      items.push({ level: 2, text, id: resolveUniqueId(text) })
      continue
    }
    const h3 = line.match(/^###\s+(.+)$/)
    if (h3) {
      const text = h3[1].trim()
      items.push({ level: 3, text, id: resolveUniqueId(text) })
    }
  }

  return items
}

export const Route = createFileRoute('/blog/$hashid')({
  loader: ({ params }) => {
    const activePost = getPostByHashid(params.hashid)
    const activeImage = activePost ? undefined : getImageByHashid(params.hashid)
    if (!activePost && !activeImage) throw notFound()

    return {
      treeItems: allTreeItems,
      activePost,
      activeImage,
      toc: activePost ? extractToc(activePost.content) : [],
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    const title = loaderData.activePost?.meta.title ?? loaderData.activeImage?.meta.title ?? 'Blog'
    const description = loaderData.activePost?.meta.description
    return {
      meta: [
        { title },
        ...(description ? [{ name: 'description', content: description }] : []),
      ],
    }
  },
  component: BlogPostPage,
})

function BlogPostPage() {
  const { treeItems, activePost, activeImage, toc } = Route.useLoaderData()
  return (
    <BlogListPage
      treeItems={treeItems}
      activePost={activePost}
      activeImage={activeImage}
      toc={Array.isArray(toc) ? toc : []}
    />
  )
}
