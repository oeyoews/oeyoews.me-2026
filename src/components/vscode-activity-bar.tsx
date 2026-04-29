import { Files, LogOut, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const OPEN_COMMAND_PALETTE_EVENT = 'open-command-palette'
const LOGOUT_EVENT = 'app-logout'

type VscodeActivityBarProps = {
  active?: 'files' | 'search' | 'settings'
  sidebarsHidden?: boolean
  onToggleSidebars?: () => void
}

export default function VscodeActivityBar({
  active = 'files',
  sidebarsHidden = false,
  onToggleSidebars,
}: VscodeActivityBarProps) {
  return (
    <div className="vscode-activity-bar">
      <div className="vscode-activity-icons">
        <button
          type="button"
          className={cn('vscode-activity-button', active === 'files' && 'vscode-activity-button-active')}
          aria-label="Files"
          title="Files"
        >
          <Files className="size-4" />
        </button>
        <button
          type="button"
          className={cn('vscode-activity-button', active === 'search' && 'vscode-activity-button-active')}
          aria-label="Search"
          title="Search (Ctrl/Cmd + K)"
          onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
        >
          <Search className="size-4" />
        </button>
        <button
          type="button"
          className="vscode-activity-button"
          aria-label={sidebarsHidden ? 'Show sidebars' : 'Hide sidebars'}
          title={sidebarsHidden ? 'Show sidebars' : 'Hide sidebars'}
          onClick={onToggleSidebars}
        >
          {sidebarsHidden ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      <button
        type="button"
        className="vscode-activity-button"
        aria-label="退出登录"
        title="退出登录"
        onClick={() => window.dispatchEvent(new Event(LOGOUT_EVENT))}
      >
        <LogOut className="size-4" />
      </button>
    </div>
  )
}
