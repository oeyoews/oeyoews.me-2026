import { createFileRoute } from '@tanstack/react-router'
import { allPosts } from '../blog/posts'
import BlogListPage from '../components/blog-list-page'

export const Route = createFileRoute('/')({
  loader: () => ({ posts: allPosts }),
  head: () => ({ meta: [{ title: 'Blog' }] }),
  component: App,
})

function App() {
  const { posts } = Route.useLoaderData()
  return <BlogListPage posts={posts} />
}
