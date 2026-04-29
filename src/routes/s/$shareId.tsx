import { createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { decodeShareToken, verifySharePassword } from '../../blog/share-id'
import { getImageByHashid, getPostByHashid } from '../../blog/posts'
import BlogReadonlyView from '../../components/blog-readonly-view'

export const Route = createFileRoute('/s/$shareId')({
  loader: ({ params }) => {
    const { hashid, passwordDigest } = decodeShareToken(params.shareId)
    if (!hashid) {
      return { post: undefined, image: undefined, passwordDigest: undefined }
    }

    const post = getPostByHashid(hashid)
    const image = post ? undefined : getImageByHashid(hashid)
    return { post, image, passwordDigest }
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
  const { post, image, passwordDigest } = Route.useLoaderData()
  const [inputPassword, setInputPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState('')

  const shouldProtect = Number.isInteger(passwordDigest)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (passwordDigest === undefined || !verifySharePassword(inputPassword, passwordDigest)) {
      setError('密码错误，请重试。')
      return
    }
    setAuthed(true)
    setInputPassword('')
    setError('')
  }

  if (shouldProtect && !authed) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
        <div className="rounded-lg border border-[#3c4353] bg-[#20252e] p-6 shadow">
          <h1 className="mb-2 text-xl font-semibold text-[#f1f4fb]">该分享已加密</h1>
          <p className="mb-5 text-sm text-[#bfc8dc]">请输入分享密码后查看内容。</p>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <input
              autoFocus
              type="password"
              value={inputPassword}
              onChange={(event) => setInputPassword(event.target.value)}
              className="w-full rounded border border-[#3c4353] bg-[#14171f] px-3 py-2 text-[#f1f4fb] outline-none focus:border-[#5b84ff]"
              placeholder="输入分享密码"
            />
            {error ? <p className="text-sm text-[#ff9ca5]">{error}</p> : null}
            <button
              type="submit"
              className="w-full rounded bg-[#5b84ff] px-3 py-2 font-medium text-white transition hover:opacity-90"
            >
              验证并查看
            </button>
          </form>
        </div>
      </main>
    )
  }

  return <BlogReadonlyView post={post} image={image} />
}

