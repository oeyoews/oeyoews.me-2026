import { createFileRoute } from '@tanstack/react-router'
import { allPosts, allTreeItems, getPostByHashid } from '../blog/posts'
import BlogListPage from '../components/blog-list-page'
import { validateBlogDevSourceSearch } from '@/lib/blog-dev-source-search'

export const Route = createFileRoute('/')({
  validateSearch: validateBlogDevSourceSearch,
  loader: () => {
    const activePostMeta = allPosts.find((post) => post.sourcePath === 'index.md') ?? allPosts[0]
    const activePost = activePostMeta ? getPostByHashid(activePostMeta.hashid) : undefined
    return {
      posts: allPosts,
      treeItems: allTreeItems,
      activePost,
      toc: [],
    }
  },
  head: () => ({ meta: [{ title: 'Blog' }] }),
  component: App,
})

function App() {
  const { posts, treeItems, activePost, toc } = Route.useLoaderData()
  const devSourceSearch = Route.useSearch()
  return (
    <BlogListPage
      posts={posts}
      treeItems={treeItems}
      activePost={activePost}
      toc={Array.isArray(toc) ? toc : []}
      devSourceSearch={devSourceSearch}
    />
  )
}
