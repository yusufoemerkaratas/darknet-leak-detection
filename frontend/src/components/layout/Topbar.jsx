import {
  Bell,
  ChevronDown,
  Command,
  Menu,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";

function Topbar({
  onOpenSidebar,
  searchValue,
  onSearchChange,
  showNotifications = true,
  showProfile = true,
  showThemeToggle = true,
}) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return (
    <header className="sticky top-0 z-20 px-1 pt-1 sm:px-1.5 xl:px-2">
      <div
        className="flex min-h-14 items-center gap-2.5 rounded-[15px] px-3 py-2"
        style={{
          backgroundColor: "var(--lg-card, #12191e)",
          border: "1px solid var(--lg-panel-border)",
        }}
      >
        <button
          className="btn-secondary rounded-lg p-1.5 text-slate-300 xl:hidden"
          onClick={onOpenSidebar}
          type="button"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div
          className="control-field flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-1.5"
        >
          <Search
            className="h-3.5 w-3.5"
            style={{ color: "var(--lg-muted, #98a2b3)" }}
          />
          <input
            className="w-full border-none bg-transparent text-[11px] outline-none"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search companies, domains, emails, leaks..."
            value={searchValue}
            style={{
              color: "var(--lg-text, #e6eef6)",
              caretColor: "var(--lg-accent, #38bdf8)",
            }}
          />
          <div className="surface-elevated hidden items-center gap-1 rounded-md border border-slate-800 px-2 py-0.5 text-[10px] text-slate-500 sm:flex">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {showNotifications ? (
            <button
              className="btn-secondary relative rounded-xl p-2 text-slate-300"
              type="button"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white">
                2
              </span>
            </button>
          ) : null}

          {showThemeToggle ? (
            <button
              className="btn-secondary rounded-xl p-2 text-slate-300"
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          ) : null}

          {showProfile ? (
            <button
              className="btn-secondary flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left"
              type="button"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-[12px] font-semibold text-white">
                A
              </span>
              <span className="hidden leading-4 lg:block">
                <span className="block text-[12px] font-medium text-slate-100">
                  Ağır
                </span>
                <span className="block text-[10px] text-slate-500">Admin</span>
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-slate-500 lg:block" />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
