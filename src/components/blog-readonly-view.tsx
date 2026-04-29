import { Streamdown } from 'streamdown'
import { createCodePlugin } from '@streamdown/code'
import { createCjkPlugin } from '@streamdown/cjk'
import { CalendarDays, Quote, SearchX } from 'lucide-react'
import type { BlogImage, BlogPost } from '../blog/posts'

const code = createCodePlugin({
  themes: ['github-light', 'one-dark-pro'],
})
const cjk = createCjkPlugin()

type BlogReadonlyViewProps = {
  post?: BlogPost
  image?: BlogImage
}

export default function BlogReadonlyView({ post, image }: BlogReadonlyViewProps) {
  if (!post && !image) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-3 px-6 text-center">
        <SearchX className="size-9 text-[#8f9bbd]" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">文章不存在</h1>
        <p className="text-sm text-muted-foreground">该分享链接无效或内容已被移除。</p>
      </main>
    )
  }

  if (image) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10">
        <header className="mb-6 space-y-2">
          <h1 className="m-0 text-[24px] leading-[1.2] font-semibold tracking-tight text-[#e7ecff] xl:text-[28px]">
            {image.meta.title}
          </h1>
          <p className="text-[12px] text-[#9aa6c5]">{image.meta.sourcePath}</p>
        </header>
        <div className="overflow-hidden rounded-lg border border-[#2f3750] bg-[#161b27] p-2">
          <img
            src={image.imageUrl}
            alt={image.meta.title}
            className="mx-auto block max-h-[80dvh] w-auto max-w-full rounded"
            loading="lazy"
          />
        </div>
      </main>
    )
  }

  const hasContent = Boolean(post?.content.trim())

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <article>
        <header className="mb-6">
          {post?.meta.title ? (
            <h1 className="m-0 text-[24px] leading-[1.2] font-semibold tracking-tight text-[#e7ecff] xl:text-[28px]">
              {post.meta.title}
            </h1>
          ) : null}
          {post?.meta.date ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-[#9aa6c5]">
              <CalendarDays className="size-3.5 shrink-0" />
              <time>{post.meta.date}</time>
            </p>
          ) : null}
          {post?.meta.description ? (
            <p className="mt-4 inline-flex w-full items-start gap-2 rounded-md border border-[#2a3450] bg-[#131b2c] px-3 py-2 text-[13px] leading-6 text-[#b7c2df]">
              <Quote className="mt-1 size-3 shrink-0 text-[#7f8aac]" />
              <span>{post.meta.description}</span>
            </p>
          ) : null}
        </header>

        {hasContent ? (
          <div className="blog-article-content max-w-none prose-pre:my-0">
            <Streamdown linkSafety={{ enabled: false }} mode="static" plugins={{ code, cjk }} controls={{ code: { download: false } }}>
              {post?.content ?? ''}
            </Streamdown>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#2f3750] bg-[#101624] px-4 py-8 text-center text-sm text-[#9aa6c5]">
            当前文章暂无正文内容。
          </div>
        )}
      </article>
    </main>
  )
}

