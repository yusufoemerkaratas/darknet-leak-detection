import { Bell, ChevronDown, Command, Menu, Moon, Search } from 'lucide-react'

function Topbar({ onOpenSidebar, searchValue, onSearchChange }) {
  return (
    <header className="sticky top-0 z-20 px-1 pt-1 sm:px-1.5 xl:px-2">
      <div className="panel-surface flex min-h-16 items-center gap-3 rounded-[16px] px-3 py-2.5">
        <button
          className="rounded-lg border border-slate-800 bg-slate-900/80 p-1.5 text-slate-300 xl:hidden"
          onClick={onOpenSidebar}
          type="button"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-800/90 bg-[#050b1d]/90 px-3 py-2">
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

        <div className="hidden items-center gap-2 md:flex">
          <button
            className="relative rounded-xl border border-slate-800 bg-slate-950/70 p-2 text-slate-300 transition hover:border-indigo-400/30 hover:text-white"
            type="button"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white">
              2
            </span>
          </button>
          <button
            className="rounded-xl border border-slate-800 bg-slate-950/70 p-2 text-slate-300 transition hover:border-indigo-400/30 hover:text-white"
            type="button"
          >
            <Moon className="h-4 w-4" />
          </button>
          <button
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-2.5 py-1.5 text-left transition hover:border-indigo-400/30"
            type="button"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-[12px] font-semibold text-white">
              A
            </span>
            <span className="hidden leading-4 lg:block">
              <span className="block text-[12px] font-medium text-slate-100">Ağır</span>
              <span className="block text-[10px] text-slate-500">Admin</span>
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-500 lg:block" />
          </button>
        </div>
      </div>
    </header>
  )
}

export default Topbar
