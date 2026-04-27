import { useEffect, useRef, useState } from 'react'
import { Streamdown } from 'streamdown'
import type { BlogPost, BlogPostMeta } from '../blog/posts'
import BlogFileTree from './blog-file-tree'
import VscodeActivityBar from './vscode-activity-bar'
import { cn } from '@/lib/utils'

type BlogListPageProps = {
  posts: BlogPostMeta[]
  activePost?: BlogPost
  toc?: Array<{ level: 2 | 3; text: string; id: string }>
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

export default function BlogListPage({ posts, activePost, toc = [] }: BlogListPageProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const tocClickLockUntilRef = useRef(0)
  const showToc = toc.length > 1
  const [activeTocId, setActiveTocId] = useState<string>('')

  const scrollToHeading = (id: string) => {
    const root = contentRef.current
    if (!root) return
    const target = root.querySelector<HTMLElement>(`[id="${id}"]`)
    if (!target) return
    tocClickLockUntilRef.current = Date.now() + 700
    setActiveTocId(id)
    target.classList.add('toc-heading-flash')
    window.setTimeout(() => target.classList.remove('toc-heading-flash'), 900)
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  useEffect(() => {
    if (!activePost) return
    const root = contentRef.current
    if (!root) return

    const headings = Array.from(root.querySelectorAll('h2, h3'))
    const idCount = new Map<string, number>()
    for (const heading of headings) {
      const text = heading.textContent?.trim()
      if (!text) continue
      const base = toHeadingId(text)
      const count = idCount.get(base) ?? 0
      idCount.set(base, count + 1)
      heading.id = count === 0 ? base : `${base}-${count}`
    }

    const scrollContainer = root.closest('.blog-col-main')
    if (!scrollContainer) return

    const updateActiveToc = () => {
      if (Date.now() < tocClickLockUntilRef.current) return
      const headingElements = Array.from(root.querySelectorAll<HTMLElement>('h2, h3'))
      if (!headingElements.length) {
        setActiveTocId('')
        return
      }

      const containerTop = scrollContainer.getBoundingClientRect().top
      const threshold = containerTop + 80
      let currentId = headingElements[0].id

      for (const heading of headingElements) {
        if (heading.getBoundingClientRect().top <= threshold) {
          currentId = heading.id
        } else {
          break
        }
      }

      setActiveTocId(currentId)
    }

    updateActiveToc()
    scrollContainer.addEventListener('scroll', updateActiveToc, { passive: true })
    return () => {
      scrollContainer.removeEventListener('scroll', updateActiveToc)
    }
  }, [activePost?.content])

  return (
    <main className="page-shell">
      <div className={cn('main-grid', !showToc && 'main-grid-no-toc')}>
        <div className="blog-side-panel">
          <div className="vscode-explorer-shell">
            <VscodeActivityBar active="files" />
            <div className="vscode-explorer-content">
              <BlogFileTree
                items={posts.map((post) => ({
                  hashid: post.hashid,
                  treePath: post.treePath,
                  sourcePath: post.sourcePath,
                }))}
                currentHashid={activePost?.meta.hashid}
              />
            </div>
          </div>
        </div>

        <section className="blog-col-main">
          {activePost ? (
            <>
              <header className="mb-6">
                <h1 className="m-0 text-[44px] leading-[1.15] font-semibold tracking-tight text-[#e7ecff]">
                  {activePost.meta.title}
                </h1>
                <p className="mt-3 text-[12px] text-[#9aa6c5]">
                  <time>{activePost.meta.date}</time>
                </p>
                {activePost.meta.description ? (
                  <p className="mt-3 text-[14px] leading-7 text-[#b1bcda]">
                    {activePost.meta.description}
                  </p>
                ) : null}
              </header>

              <div
                ref={contentRef}
                className="blog-article-content prose prose-slate max-w-none dark:prose-invert prose-headings:text-foreground/85 prose-p:text-foreground/70 prose-li:text-foreground/70"
              >
                <Streamdown mode="static">{activePost.content}</Streamdown>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">博客文章</h1>
              <p className="text-sm text-muted-foreground">暂无可预览文章</p>
            </div>
          )}
        </section>

        {showToc ? (
          <aside className="blog-col-right blog-side-panel">
            <p className="toc-panel-title">本页目录</p>
            <ul className="toc-list">
              {toc.map((item) => (
                <li
                  key={`${item.level}-${item.id}`}
                  className={cn(
                    'toc-item',
                    item.level === 3 && 'toc-item-child',
                    activeTocId === item.id && 'toc-item-active',
                  )}
                >
                  <a
                    href={`#${item.id}`}
                    className="toc-link"
                    onClick={(event) => {
                      event.preventDefault()
                      scrollToHeading(item.id)
                    }}
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </main>
  )
}
