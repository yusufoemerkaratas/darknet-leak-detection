import { useState, useRef, useEffect, useCallback } from 'react'

export interface MoreMenuAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

interface MoreMenuProps {
  actions: MoreMenuAction[]
}

export function MoreMenu({ actions }: MoreMenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setOpen((v) => !v)
  }, [])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`flex items-center justify-center w-7 h-7 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] ${open ? 'bg-[var(--surface)] text-[var(--text)]' : ''}`}
        title="More actions"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M3 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM8.5 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM14 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 100 }}
          className="w-44 rounded-xl bg-[var(--glass)] backdrop-blur-xl border border-[var(--glass-border)] shadow-2xl shadow-black/20 py-1 overflow-hidden"
        >
          {actions.map((action, i) => (
            <button
              key={i}
              disabled={action.disabled}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                action.onClick()
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs text-left disabled:opacity-40 ${
                action.danger
                  ? 'text-red-500 hover:bg-red-500/8'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
              }`}
            >
              {action.icon && <span className="shrink-0">{action.icon}</span>}
              <span className="font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
