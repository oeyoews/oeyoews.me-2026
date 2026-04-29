import { HeadContent, Link, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import CommandPalette from '../components/command-palette'
import { clearAuthed, isAuthed, setAuthed, verifyPassword } from '../lib/auth'

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var root=document.documentElement;var path=window.location&&window.location.pathname?window.location.pathname:'';var isShare=/^\\/s\\//.test(path);root.classList.remove('light','dark');if(!isShare){root.classList.add('dark');root.setAttribute('data-theme','dark');root.style.colorScheme='dark';return;}var stored=window.localStorage.getItem('share-theme');var mode=stored==='light'||stored==='dark'?stored:'dark';root.classList.add(mode);root.setAttribute('data-theme',mode);root.style.colorScheme=mode;}catch(e){}})();`
const LOGOUT_EVENT = 'app-logout'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  notFoundComponent: RootNotFound,
  shellComponent: RootDocument,
})

function RootNotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-3 px-6 text-center">
      <SearchX className="size-9 text-[#8f9bbd]" />
      <h1 className="text-2xl font-semibold">页面不存在</h1>
      <p className="opacity-80">你访问的页面不存在或已被移动。</p>
      <Link to="/" className="underline underline-offset-4">
        返回首页
      </Link>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="vscode-app font-sans antialiased wrap-anywhere selection:bg-[#3a414f] selection:text-[#f1f4fb]">
        <div className="vscode-workbench">
          <div className="flex-1 overflow-hidden">
            <AuthGate>{children}</AuthGate>
          </div>
        </div>
        <CommandPalette />
        <Scripts />
      </body>
    </html>
  )
}

function isPublicPath(pathname: string) {
  return /^\/s\/[^/]+$/.test(pathname)
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [authed, setAuthedState] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  useEffect(() => {
    setMounted(true)
    setAuthedState(isAuthed())
  }, [])

  useEffect(() => {
    const onLogout = () => {
      clearAuthed()
      setAuthedState(false)
    }
    window.addEventListener(LOGOUT_EVENT, onLogout)
    return () => window.removeEventListener(LOGOUT_EVENT, onLogout)
  }, [])

  const isPublic = useMemo(() => isPublicPath(pathname), [pathname])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!verifyPassword(password)) {
      setError('密码错误，请重试。')
      return
    }
    setAuthed()
    setAuthedState(true)
    setPassword('')
    setError('')
  }

  if (!mounted) {
    return <div className="min-h-screen bg-[#1e1e1e]" />
  }

  if (!isPublic && !authed) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
        <div className="rounded-lg border border-[#3c4353] bg-[#20252e] p-6 shadow">
          <h1 className="mb-2 text-xl font-semibold text-[#f1f4fb]">需要登录</h1>
          <p className="mb-5 text-sm text-[#bfc8dc]">请输入访问密码以继续浏览此站点内容。</p>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded border border-[#3c4353] bg-[#14171f] px-3 py-2 text-[#f1f4fb] outline-none focus:border-[#5b84ff]"
              placeholder="输入访问密码"
            />
            {error ? <p className="text-sm text-[#ff9ca5]">{error}</p> : null}
            <button
              type="submit"
              className="w-full rounded bg-[#5b84ff] px-3 py-2 font-medium text-white transition hover:opacity-90"
            >
              登录
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <>
      {children}
    </>
  )
}
