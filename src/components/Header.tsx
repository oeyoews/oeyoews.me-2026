import { Link } from '@tanstack/react-router'

export default function Header() {
  return (
    <header className="vscode-titlebar">
      <div className="grid w-full grid-cols-[1fr_minmax(260px,560px)_1fr] items-center gap-3 px-3 py-1.5">
        <div className="flex items-center gap-4 text-xs text-[#b7bfd4]">
          <Link to="/" className="font-medium text-[#d7dcef] no-underline hover:text-white">
            File
          </Link>
          <span>Edit</span>
          <span>Selection</span>
          <span>View</span>
          <span>Go</span>
        </div>

        <div className="rounded-md border border-[#3a425a] bg-[#1b2130] px-3 py-1 text-center text-xs text-[#a8b2cc]">
          oeyoews.me-2026 [Administrator]
        </div>

        <div className="text-right text-xs text-[#8f9ab6]">页面布局改成vscode</div>
      </div>
    </header>
  )
}

