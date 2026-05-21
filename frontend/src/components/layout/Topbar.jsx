import { Command, Menu, Search } from 'lucide-react'

function Topbar({ onOpenSidebar, searchValue, onSearchChange }) {
  return (
    <header className="sticky top-0 z-20 px-1 pt-1 sm:px-1.5 xl:px-2">
      <div className="panel-surface flex items-center gap-2 rounded-[14px] px-2.5 py-2">
        <button
          className="rounded-lg border border-slate-800 bg-slate-900/80 p-1.5 text-slate-300 xl:hidden"
          onClick={onOpenSidebar}
          type="button"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-800/90 bg-[#050b1d]/90 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-slate-500" />
          <input
            className="w-full border-none bg-transparent text-[11px] text-slate-100 outline-none placeholder:text-slate-500"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search companies, domains, emails, leaks..."
            value={searchValue}
          />
          <div className="hidden items-center gap-1 rounded-md border border-slate-800 bg-slate-950/80 px-2 py-0.5 text-[10px] text-slate-500 sm:flex">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Topbar
