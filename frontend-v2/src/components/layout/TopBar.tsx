import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useTheme } from '../../context/ThemeContext'
import { Kbd } from '../ui/Kbd'
import type { Theme } from '../../types'

const SunIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.06 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM5.404 6.464a.75.75 0 0 0 1.06-1.06L5.404 4.343a.75.75 0 0 0-1.06 1.06l1.06 1.061Z" />
  </svg>
)

const MoonIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" clipRule="evenodd" />
  </svg>
)

const MonitorIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 0 1 4.25 2h11.5A2.25 2.25 0 0 1 18 4.25v8.5A2.25 2.25 0 0 1 15.75 15h-3.105a3.501 3.501 0 0 0 1.1 1.677A.75.75 0 0 1 13.26 18H6.74a.75.75 0 0 1-.484-1.323A3.501 3.501 0 0 0 7.355 15H4.25A2.25 2.25 0 0 1 2 12.75v-8.5Zm1.5 0a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-.75.75H4.25a.75.75 0 0 1-.75-.75v-7.5Z" clipRule="evenodd" />
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14, marginLeft: 'auto' }}>
    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
  </svg>
)

const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light',  label: 'Light',  icon: <SunIcon /> },
  { value: 'dark',   label: 'Dark',   icon: <MoonIcon /> },
  { value: 'system', label: 'System', icon: <MonitorIcon /> },
]

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

interface TopBarProps {
  title: string
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onOpenPalette: () => void
}

export function TopBar({ title, sidebarOpen, onToggleSidebar, onOpenPalette }: TopBarProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        buttonRef.current && !buttonRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function toggleDropdown() {
    if (buttonRef.current) setRect(buttonRef.current.getBoundingClientRect())
    setOpen((v) => !v)
  }

  function handleSetTheme(value: Theme, label: string) {
    setTheme(value)
    setOpen(false)
    toast.success(`Theme: ${label}`)
  }

  const ActiveIcon = resolvedTheme === 'dark' ? MoonIcon : SunIcon

  const dropdownTop  = rect ? rect.bottom + 8 : 0
  const dropdownRight = rect ? window.innerWidth - rect.right : 0

  const isDark = document.documentElement.classList.contains('dark')

  const dropdownMenu = open && rect ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: dropdownTop,
        right: dropdownRight,
        zIndex: 99999,
        width: 152,
        background: isDark ? '#0c1219' : '#ffffff',
        borderRadius: 12,
        border: `1px solid ${isDark ? 'rgba(30,50,72,0.6)' : 'rgba(180,200,235,0.5)'}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)',
        padding: '4px 0',
        overflow: 'hidden',
      }}
    >
      {themeOptions.map((opt) => {
        const isActive = theme === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => handleSetTheme(opt.value, opt.label)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '8px 12px',
              background: isActive
                ? (isDark ? 'rgba(59,130,246,0.12)' : 'rgba(37,99,235,0.08)')
                : 'transparent',
              color: isActive
                ? (isDark ? '#60a5fa' : '#2563eb')
                : (isDark ? '#7a93a8' : '#64748b'),
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              textAlign: 'left',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = isDark ? '#080c14' : '#eef1f8'
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
          >
            {opt.icon}
            <span style={{ textTransform: 'capitalize' }}>{opt.label}</span>
            {isActive && <CheckIcon />}
          </button>
        )
      })}
    </div>,
    document.body
  ) : null

  return (
    <header
      className="h-14 flex items-center justify-between px-4 shrink-0"
      style={{
        background: 'var(--glass)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--glass-border)',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
          </svg>
        </button>
        <Kbd>B</Kbd>
        <div className="w-px h-4 bg-[var(--border)] mx-1" />
        <h1 className="text-sm font-semibold text-[var(--text)]">{title}</h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenPalette}
          className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--primary)]/40 text-xs"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <span className="text-[var(--text-muted)]">Search commands…</span>
          <Kbd>{isMac ? '⌘K' : 'Ctrl+K'}</Kbd>
        </button>

        <button
          ref={buttonRef}
          onClick={toggleDropdown}
          title="Change theme"
          className={`flex items-center justify-center w-8 h-8 rounded-full border ${
            open
              ? 'bg-[var(--surface)] border-[var(--primary)] text-[var(--primary)]'
              : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--primary)]'
          }`}
        >
          <ActiveIcon />
        </button>
      </div>

      {dropdownMenu}
    </header>
  )
}
