import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { CommandPalette } from '../CommandPalette'
import { WaveBackground } from '../ui/WaveBackground'

const pageTitles: Record<string, string> = {
  '/': 'Security Overview',
  '/findings': 'Threat Findings',
  '/alerts': 'Security Alerts',
  '/sources': 'Data Sources',
  '/companies': 'Companies',
  '/crawl-jobs': 'Collection Log',
}

function isInputFocused() {
  const tag = document.activeElement?.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

export function Layout() {
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const title = pageTitles[pathname] ?? 'Darknet Leak Detection'
  const sidebarW = sidebarOpen ? '240px' : '56px'

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K → command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      // B → toggle sidebar (not while typing)
      if (!isInputFocused() && !e.metaKey && !e.ctrlKey && !e.altKey && e.key === 'b') {
        setSidebarOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full">
      <WaveBackground />
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />
      <div
        className="flex flex-col flex-1 relative z-[1] transition-[margin] duration-200 ease-in-out"
        style={{ marginLeft: sidebarW }}
      >
        <TopBar
          title={title}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
        </main>

      </div>
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
