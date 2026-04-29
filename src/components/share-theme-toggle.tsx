import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type ShareTheme = 'light' | 'dark'

const STORAGE_KEY = 'share-theme'

function normalizeTheme(value: unknown): ShareTheme {
  return value === 'light' || value === 'dark' ? value : 'dark'
}

function applyTheme(mode: ShareTheme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(mode)
  root.setAttribute('data-theme', mode)
  root.style.colorScheme = mode
}

export default function ShareThemeToggle() {
  const [theme, setTheme] = useState<ShareTheme>('dark')

  useEffect(() => {
    const stored = normalizeTheme(window.localStorage.getItem(STORAGE_KEY))
    setTheme(stored)
    applyTheme(stored)
  }, [])

  const toggle = () => {
    const next: ShareTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    window.localStorage.setItem(STORAGE_KEY, next)
    applyTheme(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground/80 hover:bg-muted hover:text-foreground"
      aria-label="切换明暗主题"
      title={`当前：${theme === 'dark' ? '暗色' : '亮色'}，点击切换`}
    >
      {theme === 'dark' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
      <span>{theme === 'dark' ? '暗色' : '亮色'}</span>
    </button>
  )
}

