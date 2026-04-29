import { createFileRoute } from '@tanstack/react-router'
import { decodeShareId } from '../blog/share-id'
import { getImageByHashid, getPostByHashid } from '../blog/posts'
import BlogReadonlyView from '../components/blog-readonly-view'

export const Route = createFileRoute('/$shareId')({
  loader: ({ params }) => {
    const hashid = decodeShareId(params.shareId)
    if (!hashid) {
      return { post: undefined, image: undefined }
    }

    const post = getPostByHashid(hashid)
    const image = post ? undefined : getImageByHashid(hashid)
    return { post, image }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    const title = loaderData.post?.meta.title || loaderData.image?.meta.title || 'Share'
    const description = loaderData.post?.meta.description
    return {
      meta: [
        { title },
        ...(description ? [{ name: 'description', content: description }] : []),
      ],
    }
  },
  component: ShareReadonlyPage,
})

function ShareReadonlyPage() {
  const { post, image } = Route.useLoaderData()
  return <BlogReadonlyView post={post} image={image} />
}

