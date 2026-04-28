import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Command } from 'cmdk'
import { ArrowUpRight, Compass, FileText, Search } from 'lucide-react'
import { allPosts } from '../blog/posts'

const OPEN_COMMAND_PALETTE_EVENT = 'open-command-palette'

type PaletteAction = {
  id: string
  label: string
  keywords?: string
  kind: 'navigation' | 'post'
  run: () => void
}

export default function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((prev) => !prev)
      }

      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    const onOpenEvent = () => {
      setOpen(true)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const focusTimer = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => window.cancelAnimationFrame(focusTimer)
  }, [open])

  const navigationActions = useMemo<PaletteAction[]>(
    () => [
      {
        id: 'go-home',
        label: 'Go to Home',
        keywords: 'index landing',
        kind: 'navigation',
        run: () => navigate({ to: '/' }),
      },
      {
        id: 'go-blog',
        label: 'Go to Blog',
        keywords: 'posts article list',
        kind: 'navigation',
        run: () => navigate({ to: '/blog' }),
      },
    ],
    [navigate],
  )

  const postActions = useMemo<PaletteAction[]>(
    () =>
      allPosts.map((post) => ({
        id: `post-${post.hashid}`,
        label: post.title,
        keywords: `${post.hashid} ${post.treePath} ${post.sourcePath}`,
        kind: 'post',
        run: () =>
          navigate({
            to: '/blog/$hashid',
            params: { hashid: post.hashid },
          }),
      })),
    [navigate],
  )

  const runAction = (action: PaletteAction) => {
    setOpen(false)
    action.run()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#0d111b]/70 px-4 pt-[10dvh] backdrop-blur-[1px]"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <Command
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-[#2f3750] bg-[#1a2030] text-[#d7dcef] shadow-2xl"
        label="Command Palette"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-[#2f3750]">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[#8e99b8]" />
          <Command.Input
            ref={inputRef}
            autoFocus
            placeholder="Type a command or search posts..."
            className="h-12 w-full bg-transparent pr-4 pl-10 text-sm text-[#d7dcef] outline-none placeholder:text-[#8e99b8]"
          />
        </div>
        <Command.List className="max-h-[60dvh] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-[#8e99b8]">
            No results found.
          </Command.Empty>

          <Command.Group heading="Navigation" className="text-[#8e99b8]">
            {navigationActions.map((action) => (
              <Command.Item
                key={action.id}
                value={`${action.label} ${action.keywords ?? ''}`}
                onSelect={() => runAction(action)}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-[#d7dcef] outline-none data-[selected=true]:bg-[#2a3450]"
              >
                {action.kind === 'navigation' ? (
                  <Compass className="size-4 shrink-0 text-[#8e99b8]" />
                ) : (
                  <ArrowUpRight className="size-4 shrink-0 text-[#8e99b8]" />
                )}
                <span className="truncate">{action.label}</span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Separator className="my-2 h-px bg-[#2f3750]" />

          <Command.Group heading="Posts" className="text-[#8e99b8]">
            {postActions.map((action) => (
              <Command.Item
                key={action.id}
                value={`${action.label} ${action.keywords ?? ''}`}
                onSelect={() => runAction(action)}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-[#d7dcef] outline-none data-[selected=true]:bg-[#2a3450]"
              >
                {action.kind === 'post' ? (
                  <FileText className="size-4 shrink-0 text-[#8e99b8]" />
                ) : (
                  <ArrowUpRight className="size-4 shrink-0 text-[#8e99b8]" />
                )}
                <span className="truncate">{action.label}</span>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  )
}
