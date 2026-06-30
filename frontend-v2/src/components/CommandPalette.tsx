import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { toast } from 'sonner'
import type { Theme } from '../types'

interface Command {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  category: string
  keywords?: string
  shortcut?: string[]
  onSelect: () => void
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

const icons = {
  grid: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M2 4a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4Zm9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4Zm0 7a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5ZM2 12a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-4Z" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M4 16.5v-13h-.25a.75.75 0 0 1 0-1.5h12.5a.75.75 0 0 1 0 1.5H16v13h.25a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75v-2.5a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1 0-1.5H4Zm3-11a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm.5 3.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Zm2.5-4a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm.5 3.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Z" clipRule="evenodd" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.389Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.06 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM5.404 6.464a.75.75 0 0 0 1.06-1.06L5.404 4.343a.75.75 0 0 0-1.06 1.06l1.06 1.061Z" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" clipRule="evenodd" />
    </svg>
  ),
  monitor: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 0 1 4.25 2h11.5A2.25 2.25 0 0 1 18 4.25v8.5A2.25 2.25 0 0 1 15.75 15h-3.105a3.501 3.501 0 0 0 1.1 1.677A.75.75 0 0 1 13.26 18H6.74a.75.75 0 0 1-.484-1.323A3.501 3.501 0 0 0 7.355 15H4.25A2.25 2.25 0 0 1 2 12.75v-8.5Zm1.5 0a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 .75.75v7.5a.75.75 0 0 1-.75.75H4.25a.75.75 0 0 1-.75-.75v-7.5Z" clipRule="evenodd" />
    </svg>
  ),
}

function KbdKey({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 min-w-[1.25rem] rounded text-[10px] font-mono border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] leading-none">
      {label}
    </kbd>
  )
}

export function CommandPalette({ isOpen, onClose }: Props) {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    onClose()
    setQuery('')
    setSelected(0)
  }, [onClose])

  const goTo = useCallback((path: string) => {
    navigate(path)
    close()
  }, [navigate, close])

  const switchTheme = useCallback((t: Theme, label: string) => {
    setTheme(t)
    toast.success(`Theme: ${label}`)
    close()
  }, [setTheme, close])

  const commands: Command[] = useMemo(() => [
    { id: 'nav-dashboard',  category: 'Navigate',   label: 'Dashboard',         description: 'Security overview & statistics', icon: icons.grid,     shortcut: ['G', 'D'], keywords: 'home overview stats', onSelect: () => goTo('/') },
    { id: 'nav-findings',   category: 'Navigate',   label: 'Threat Findings',   description: 'View and triage detections',     icon: icons.search,   shortcut: ['G', 'F'], keywords: 'findings threats leaks detections', onSelect: () => goTo('/findings') },
    { id: 'nav-alerts',     category: 'Navigate',   label: 'Security Alerts',   description: 'Critical security notifications', icon: icons.alert,    shortcut: ['G', 'A'], keywords: 'alerts notifications critical', onSelect: () => goTo('/alerts') },
    { id: 'nav-sources',    category: 'Navigate',   label: 'Data Sources',      description: 'Manage monitored crawl targets', icon: icons.eye,      shortcut: ['G', 'S'], keywords: 'sources targets monitoring crawl', onSelect: () => goTo('/sources') },
    { id: 'nav-companies',  category: 'Navigate',   label: 'Companies',         description: 'Manage tracked organizations',   icon: icons.building, shortcut: ['G', 'C'], keywords: 'companies organizations clients', onSelect: () => goTo('/companies') },
    { id: 'nav-jobs',       category: 'Navigate',   label: 'Collection Log',    description: 'Crawl job history & status',     icon: icons.refresh,  shortcut: ['G', 'J'], keywords: 'crawl jobs collection history log', onSelect: () => goTo('/crawl-jobs') },
    { id: 'theme-light',    category: 'Appearance', label: 'Light Theme',       icon: icons.sun,     keywords: 'theme light mode appearance', onSelect: () => switchTheme('light', 'Light') },
    { id: 'theme-dark',     category: 'Appearance', label: 'Dark Theme',        icon: icons.moon,    keywords: 'theme dark mode night appearance', onSelect: () => switchTheme('dark', 'Dark') },
    { id: 'theme-system',   category: 'Appearance', label: 'System Theme',      icon: icons.monitor, keywords: 'theme system auto appearance', onSelect: () => switchTheme('system', 'System') },
  ], [goTo, switchTheme])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.keywords?.toLowerCase().includes(q)
    )
  }, [commands, query])

  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>()
    for (const cmd of filtered) {
      if (!map.has(cmd.category)) map.set(cmd.category, [])
      map.get(cmd.category)!.push(cmd)
    }
    return map
  }, [filtered])

  useEffect(() => {
    if (isOpen) {
      setSelected(0)
      const t = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    } else {
      setQuery('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { close(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(v => Math.min(v + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(v => Math.max(v - 1, 0)) }
      if (e.key === 'Enter')     { e.preventDefault(); filtered[selected]?.onSelect() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, filtered, selected, close])

  useEffect(() => {
    if (!listRef.current) return
    listRef.current
      .querySelector(`[data-idx="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-start justify-center pt-20 px-4 transition-opacity duration-150 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={close} />

      <div
        className={`relative w-full max-w-[560px] rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)] backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden transition-all duration-150 ${
          isOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-3 scale-[0.97]'
        }`}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 text-[var(--text-muted)]">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Search commands…"
            className="flex-1 bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <KbdKey label="Esc" />
        </div>

        {/* Command list */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-[var(--text-muted)] py-10">No commands found.</p>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category}>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                  {category}
                </p>
                {items.map((cmd) => {
                  const idx = filtered.indexOf(cmd)
                  const isSelected = selected === idx
                  return (
                    <button
                      key={cmd.id}
                      data-idx={idx}
                      onClick={cmd.onSelect}
                      onMouseEnter={() => setSelected(idx)}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                          : 'text-[var(--text)] hover:bg-[var(--surface)]'
                      }`}
                    >
                      <span className={`shrink-0 ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
                        {cmd.icon}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="text-sm font-medium block leading-snug">{cmd.label}</span>
                        {cmd.description && (
                          <span className="text-xs text-[var(--text-muted)] block leading-snug">{cmd.description}</span>
                        )}
                      </span>
                      {cmd.shortcut && (
                        <span className="shrink-0 flex gap-1">
                          {cmd.shortcut.map((k) => <KbdKey key={k} label={k} />)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--border)] bg-[var(--surface)]/40">
          <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <KbdKey label="↑" /><KbdKey label="↓" />
            <span className="ml-0.5">navigate</span>
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <KbdKey label="↵" />
            <span className="ml-0.5">select</span>
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <KbdKey label="Esc" />
            <span className="ml-0.5">close</span>
          </span>
        </div>
      </div>
    </div>
  )
}
