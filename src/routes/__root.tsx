import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import CommandPalette from '../components/command-palette'

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

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
          <div className="flex-1 overflow-hidden">{children}</div>
        </div>
        <CommandPalette />
        <Scripts />
      </body>
    </html>
  )
}
