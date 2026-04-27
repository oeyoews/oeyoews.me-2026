import { createFileRoute } from '@tanstack/react-router'
import { allPosts, allTreeItems, getPostByHashid } from '../blog/posts'
import BlogListPage from '../components/blog-list-page'

export const Route = createFileRoute('/')({
  loader: () => {
    const activePostMeta = allPosts[0]
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
  return (
    <BlogListPage
      posts={posts}
      treeItems={treeItems}
      activePost={activePost}
      toc={Array.isArray(toc) ? toc : []}
    />
  )
}
