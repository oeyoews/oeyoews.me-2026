import { Streamdown } from 'streamdown'
import { createCodePlugin } from '@streamdown/code'
import { createCjkPlugin } from '@streamdown/cjk'
import { CalendarDays, Quote, SearchX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { BlogImage, BlogPost } from '../blog/posts'
import ShareThemeToggle from './share-theme-toggle'

const code = createCodePlugin({
  themes: ['github-light', 'one-dark-pro'],
})
const cjk = createCjkPlugin()

type BlogReadonlyViewProps = {
  post?: BlogPost
  image?: BlogImage
}

export default function BlogReadonlyView({ post, image }: BlogReadonlyViewProps) {
  const postContent = post?.content ?? ''
  const hasContent = Boolean(postContent.trim())
  const [streamedContent, setStreamedContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isCaretBright, setIsCaretBright] = useState(true)
  const streamTailRef = useRef<HTMLSpanElement | null>(null)
  const shouldAutoScrollRef = useRef(true)

  useEffect(() => {
    if (!isStreaming) {
      setIsCaretBright(true)
      return
    }

    const interval = window.setInterval(() => {
      setIsCaretBright((prev) => !prev)
    }, 620)

    return () => {
      window.clearInterval(interval)
    }
  }, [isStreaming])

  useEffect(() => {
    if (!hasContent) {
      setStreamedContent('')
      setIsStreaming(false)
      return
    }

    let timer: number | null = null
    let currentIndex = 0
    shouldAutoScrollRef.current = true
    setStreamedContent('')
    setIsStreaming(true)

    const pauseChars = new Set(['。', '！', '？', '.', '!', '?', '\n', ',', '，', '、', ';', '；', ':', '：'])
    const longPauseChars = new Set(['。', '！', '？', '.', '!', '?', '\n'])

    const getHumanStep = () => {
      const seed = Math.random()
      if (seed < 0.12) return 1
      if (seed < 0.52) return 2
      if (seed < 0.86) return 3
      return 4
    }

    const getHumanDelay = (nextIndex: number) => {
      const char = postContent[nextIndex - 1] ?? ''
      const jitter = Math.floor(Math.random() * 90)
      if (longPauseChars.has(char)) {
        return 240 + jitter
      }
      if (pauseChars.has(char)) {
        return 140 + jitter
      }
      return 42 + jitter
    }

    const emitChunk = () => {
      const step = getHumanStep()
      currentIndex = Math.min(postContent.length, currentIndex + step)
      setStreamedContent(postContent.slice(0, currentIndex))

      if (currentIndex >= postContent.length) {
        setIsStreaming(false)
        return
      }

      timer = window.setTimeout(emitChunk, getHumanDelay(currentIndex))
    }

    timer = window.setTimeout(emitChunk, 120)

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer)
      }
    }
  }, [hasContent, post?.meta.hashid, postContent])

  useEffect(() => {
    const isNearBottom = () => {
      const doc = document.documentElement
      const remaining = doc.scrollHeight - (window.scrollY + window.innerHeight)
      return remaining <= 120
    }

    const handleScroll = () => {
      shouldAutoScrollRef.current = isNearBottom()
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [post?.meta.hashid])

  useEffect(() => {
    if (!isStreaming) return
    if (!shouldAutoScrollRef.current) return
    streamTailRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [isStreaming, streamedContent])

  if (!post && !image) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="mb-4 flex justify-end sm:fixed sm:top-4 sm:right-4 sm:z-20">
          <ShareThemeToggle />
        </div>
        <SearchX className="size-9 text-[#8f9bbd]" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">文章不存在</h1>
        <p className="text-sm text-muted-foreground">该分享链接无效或内容已被移除。</p>
      </main>
    )
  }

  if (image) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 pt-5 pb-10">
        <div className="mb-4 flex justify-end sm:fixed sm:top-4 sm:right-4 sm:z-20">
          <ShareThemeToggle />
        </div>
        <header className="mb-6 space-y-2">
          <h1 className="m-0 text-[24px] leading-[1.2] font-semibold tracking-tight text-foreground xl:text-[28px]">
            {image.meta.title}
          </h1>
          <p className="text-[12px] text-muted-foreground">{image.meta.sourcePath}</p>
        </header>
        <div className="overflow-hidden rounded-lg border border-border bg-background p-2">
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

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-5 pb-10">
      <div className="mb-4 flex justify-end sm:fixed sm:top-4 sm:right-4 sm:z-20">
        <ShareThemeToggle />
      </div>
      <article>
        <header className="mb-6">
          {post?.meta.title ? (
            <h1 className="m-0 text-[24px] leading-[1.2] font-semibold tracking-tight text-foreground xl:text-[28px]">
              {post.meta.title}
            </h1>
          ) : null}
          {post?.meta.date ? (
            <p className="mt-3 flex w-full items-center justify-end gap-1.5 text-[12px] text-muted-foreground">
              <CalendarDays className="size-3.5 shrink-0" />
              <time>{post.meta.date}</time>
            </p>
          ) : null}
          {post?.meta.description ? (
            <p className="mt-4 inline-flex w-full items-start gap-2 rounded-md border border-border bg-muted px-3 py-2 text-[13px] leading-6 text-foreground/80">
              <Quote className="mt-1 size-3 shrink-0 text-muted-foreground" />
              <span>{post.meta.description}</span>
            </p>
          ) : null}
        </header>

        {hasContent ? (
          <div className="blog-article-content max-w-none prose-pre:my-0">
            <Streamdown
              linkSafety={{ enabled: false }}
              mode="streaming"
              isAnimating={isStreaming}
              plugins={{ code, cjk }}
              controls={{ code: { download: false } }}
            >
              {isStreaming ? `${streamedContent}&nbsp;${isCaretBright ? '●' : '•'}` : streamedContent}
            </Streamdown>
            <span ref={streamTailRef} aria-hidden="true" className="block h-px w-full" />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/60 px-4 py-8 text-center text-sm text-muted-foreground">
            当前文章暂无正文内容。
          </div>
        )}
      </article>
    </main>
  )
}

