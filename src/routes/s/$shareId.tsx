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
  const streamQuery =
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('stream')
  const streamEnabled = streamQuery ? !['0', 'false', 'off'].includes(streamQuery.toLowerCase()) : true

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
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-background px-6">
        <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow">
          <h1 className="mb-2 text-xl font-semibold text-foreground">该分享已加密</h1>
          <p className="mb-5 text-sm text-muted-foreground">请输入分享密码后查看内容。</p>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <input
              autoFocus
              type="password"
              value={inputPassword}
              onChange={(event) => setInputPassword(event.target.value)}
              className="w-full rounded border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              placeholder="输入分享密码"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <button
              type="submit"
              className="w-full rounded bg-primary px-3 py-2 font-medium text-primary-foreground transition hover:opacity-90"
            >
              验证并查看
            </button>
          </form>
        </div>
      </main>
    )
  }

  return <BlogReadonlyView post={post} image={image} stream={streamEnabled} />
}

