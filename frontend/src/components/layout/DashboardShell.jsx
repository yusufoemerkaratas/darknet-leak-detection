import { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

function DashboardShell({
  activeItem,
  onSelectItem,
  children,
  rightPanel,
  searchValue,
  onSearchChange,
  sidebarStatusCards,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSelect = (itemId) => {
    onSelectItem?.(itemId)
    setSidebarOpen(false)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.18),transparent_54%)]" />
        <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-blue-500/8 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-fuchsia-500/6 blur-3xl" />
        <div className="grid-fade absolute inset-0 opacity-25" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1540px] px-3 py-3 xl:px-4 xl:py-4">
        <Sidebar
          activeItem={activeItem}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSelectItem={handleSelect}
          statusCards={sidebarStatusCards}
        />

        <div className="flex min-w-0 flex-1 flex-col xl:pl-[194px]">
          <Topbar
            onOpenSidebar={() => setSidebarOpen(true)}
            searchValue={searchValue}
            onSearchChange={onSearchChange}
          />

          <main className="flex-1 px-1 pb-1 pt-1.5 sm:px-1.5 xl:px-2">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_244px] 2xl:grid-cols-[minmax(0,1fr)_252px]">
              <section className="min-w-0 space-y-3">{children}</section>
              <aside className="min-w-0 space-y-3">{rightPanel}</aside>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default DashboardShell
