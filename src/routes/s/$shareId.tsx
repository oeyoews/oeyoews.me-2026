import { createFileRoute } from '@tanstack/react-router'
import { useState, type SubmitEvent } from 'react'
import { decodeShareToken, verifySharePassword } from '../../blog/share-id'
import { getPostByHashid } from '../../blog/posts'
import BlogReadonlyView from '../../components/blog-readonly-view'

type ShareSearch = {
  /** 0 = 关闭流式，1 = 开启；用数字可避免 Router 默认 stringifySearch 对字符串做 JSON 编码从而在地址栏出现 "0" */
  stream?: 0 | 1
}

function normalizeStreamSearchParam(raw: Record<string, unknown>): 0 | 1 | undefined {
  const v = raw.stream
  if (v === undefined || v === null) return undefined
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return undefined
    return v === 0 ? 0 : 1
  }
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase()
    if (t === '') return undefined
    if (t === '0' || t === 'false' || t === 'off') return 0
    if (t === '1' || t === 'true' || t === 'on') return 1
    const n = Number(t)
    if (Number.isFinite(n)) return n === 0 ? 0 : 1
    return undefined
  }
  if (Array.isArray(v) && v.length > 0) {
    return normalizeStreamSearchParam({ stream: v[0] })
  }
  return undefined
}

export const Route = createFileRoute('/s/$shareId')({
  validateSearch: (raw: Record<string, unknown>): ShareSearch => ({
    stream: normalizeStreamSearchParam(raw),
  }),
  loader: ({ params }) => {
    const { hashid, passwordDigest } = decodeShareToken(params.shareId)
    if (!hashid) {
      return { post: undefined, passwordDigest: undefined }
    }

    const post = getPostByHashid(hashid)
    return { post, passwordDigest }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    const title = loaderData.post?.meta.title || 'Share'
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
  const { stream: streamParam } = Route.useSearch()
  const { post, passwordDigest } = Route.useLoaderData()
  const [inputPassword, setInputPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState('')

  const shouldProtect = Number.isInteger(passwordDigest)
  const streamEnabled = streamParam === undefined ? true : streamParam !== 0

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
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

  return <BlogReadonlyView post={post} stream={streamEnabled} />
}

