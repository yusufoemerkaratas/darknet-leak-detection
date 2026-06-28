import { useState } from 'react'
import { NavLink } from 'react-router-dom'

const navItems = [
  {
    path: '/overview',
    label: 'Overview',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path d="M2 4a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4Zm9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4Zm0 7a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5ZM2 12a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-4Z" />
      </svg>
    ),
  },
  {
    path: '/findings',
    label: 'Threat Findings',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    path: '/alerts',
    label: 'Security Alerts',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    path: '/sources',
    label: 'Data Sources',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    path: '/companies',
    label: 'Companies',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path fillRule="evenodd" d="M4 16.5v-13h-.25a.75.75 0 0 1 0-1.5h12.5a.75.75 0 0 1 0 1.5H16v13h.25a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75v-2.5a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1 0-1.5H4Zm3-11a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1ZM7.5 9a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1ZM11 5.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm.5 3.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    path: '/crawl-jobs',
    label: 'Collection Log',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
        <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.389Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
      </svg>
    ),
  },
]

interface SidebarProps {
  isOpen: boolean
  onToggle?: () => void
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [aboutOpen, setAboutOpen] = useState(false)

  return (
    <aside
      style={{ width: isOpen ? '240px' : '56px', cursor: 'pointer' }}
      className="fixed inset-y-0 left-0 flex flex-col z-20 overflow-hidden"
      onClick={onToggle}
    >
      <style>{`
        aside {
          transition: width 250ms cubic-bezier(0.4, 0, 0.2, 1);
          background: var(--glass);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-right: 1px solid var(--glass-border);
        }

        /* light mode: distinct blue sidebar */
        :root:not(.dark) aside {
          background: #1a3f8f;
          border-right-color: rgba(40, 75, 160, 0.25);
          --text: #e8efff;
          --text-muted: #93b0e0;
          --border: rgba(255, 255, 255, 0.12);
          --surface: rgba(255, 255, 255, 0.08);
        }
        :root:not(.dark) aside .text-blue-400 { color: #93c5fd; }
        :root:not(.dark) aside .border-blue-500 { border-color: #93c5fd; }
      `}</style>

      {/* Brand header */}
      <div className="relative flex items-center h-14 border-b border-[var(--glass-border)] shrink-0 overflow-hidden">
        <span
          className="absolute text-lg tracking-tight whitespace-nowrap select-none flex items-baseline"
          style={{
            left: isOpen ? '1.25rem' : '50%',
            transform: isOpen ? 'translateX(0)' : 'translateX(-50%)',
            transition: 'left 280ms cubic-bezier(0.4,0,0.2,1), transform 280ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {/* D — scales up slightly when alone */}
          <span
            className="font-normal text-[var(--text)] inline-block"
            style={{
              transform: isOpen ? 'scale(1)' : 'scale(1.15)',
              transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              transformOrigin: '50% 85%',
            }}
          >D</span>

          {/* "ark" */}
          <span
            className="overflow-hidden inline-block align-baseline"
            style={{
              maxWidth: isOpen ? '2.5rem' : '0',
              transition: isOpen
                ? 'max-width 420ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                : 'max-width 420ms cubic-bezier(0.4, 0, 0.2, 1) 80ms',
            }}
          >
            {['a', 'r', 'k'].map((letter, i) => (
              <span
                key={i}
                className="font-normal text-[var(--text)] inline-block"
                style={{
                  opacity: isOpen ? 1 : 0,
                  transform: isOpen ? 'translateX(0)' : 'translateX(-6px)',
                  transition: isOpen
                    ? `opacity 200ms ease ${i * 55}ms, transform 200ms ease ${i * 55}ms`
                    : `opacity 200ms ease ${(2 - i) * 55}ms, transform 200ms ease ${(2 - i) * 55}ms`,
                }}
              >{letter}</span>
            ))}
          </span>

          {/* L — scales up slightly when alone */}
          <span
            className="font-black text-blue-400 inline-block"
            style={{
              transform: isOpen ? 'scale(1)' : 'scale(1.15)',
              transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1) 30ms',
              transformOrigin: '50% 85%',
            }}
          >L</span>

          {/* "eak" */}
          <span
            className="overflow-hidden inline-block align-baseline"
            style={{
              maxWidth: isOpen ? '2.5rem' : '0',
              transition: isOpen
                ? 'max-width 420ms cubic-bezier(0.34, 1.56, 0.64, 1) 50ms'
                : 'max-width 420ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {['e', 'a', 'k'].map((letter, i) => (
              <span
                key={i}
                className="font-black text-blue-400 inline-block"
                style={{
                  opacity: isOpen ? 1 : 0,
                  transform: isOpen ? 'translateX(0)' : 'translateX(-6px)',
                  transition: isOpen
                    ? `opacity 200ms ease ${50 + i * 55}ms, transform 200ms ease ${50 + i * 55}ms`
                    : `opacity 200ms ease ${(2 - i) * 55}ms, transform 200ms ease ${(2 - i) * 55}ms`,
                }}
              >{letter}</span>
            ))}
          </span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        <p
          className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap transition-[opacity,padding] duration-200"
          style={{ opacity: isOpen ? 1 : 0, paddingLeft: isOpen ? '1.25rem' : '0' }}
        >
          Menu
        </p>

        <ul className="space-y-0.5" onClick={(e) => e.stopPropagation()}>
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/overview'}
                title={!isOpen ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 py-2 text-sm font-medium border-l-[3px] ${
                    isActive
                      ? 'border-blue-500 text-blue-400 pl-[calc(1rem-3px)] pr-4'
                      : 'border-transparent text-[var(--text-muted)] pl-4 pr-4 hover:text-[var(--text)] hover:bg-[var(--surface)]'
                  }`
                }
              >
                {item.icon}
                <span
                  className="whitespace-nowrap overflow-hidden transition-opacity duration-200"
                  style={{ opacity: isOpen ? 1 : 0 }}
                >
                  {item.label}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Expandable about panel */}
      <div
        className="overflow-hidden shrink-0"
        style={{
          maxHeight: isOpen && aboutOpen ? '180px' : '0',
          transition: 'max-height 280ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div className="px-5 pt-3 pb-2.5 border-t border-[var(--glass-border)]">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-2 opacity-60">Contributors</p>
          <div className="space-y-1.5 mb-3">
            {([
              { name: 'Beyza Betül Ay',         url: 'https://www.linkedin.com/in/beyza-betuel-ay/' },
              { name: 'Fidan Eylül Yalçınkaya', url: null },
              { name: 'Nihal Beyza Dogan',       url: 'https://www.linkedin.com/in/nihal-beyza-dogan-76656823a/?locale=tr' },
              { name: 'Yusuf Ömer Karataş',     url: 'https://www.linkedin.com/in/yusuf-ömer-karatas-330952219/' },
            ] as { name: string; url: string | null }[]).map(({ name, url }) =>
              url ? (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors group leading-none"
                >
                  {name}
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50 transition-opacity shrink-0">
                    <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z"/>
                  </svg>
                </a>
              ) : (
                <p key={name} className="text-[11px] text-[var(--text-muted)] leading-none">{name}</p>
              )
            )}
          </div>
          <a
            href="https://git.fiw.fhws.de/programmier-projekte/darknet-leak-detection"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 opacity-60">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            View Repository
          </a>
        </div>
      </div>

      {/* Bottom status */}
      <div className="border-t border-[var(--glass-border)] shrink-0">
        <div
          className="flex items-center gap-2.5 py-3 overflow-hidden"
          style={{ paddingLeft: isOpen ? '1.25rem' : '1rem', paddingRight: isOpen ? '0.75rem' : '1rem' }}
        >
          <span className="relative flex shrink-0 w-2 h-2">
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-70" />
            <span className="relative inline-flex rounded-full w-2 h-2 bg-green-500" />
          </span>
          <span
            className="text-xs text-[var(--text-muted)] whitespace-nowrap flex-1 transition-opacity duration-200"
            style={{ opacity: isOpen ? 1 : 0 }}
          >
            System Online
          </span>
          {isOpen && (
            <button
              onClick={(e) => { e.stopPropagation(); setAboutOpen((v) => !v) }}
              className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0"
              title="About"
            >
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-3.5 h-3.5 transition-transform duration-200"
                style={{ transform: aboutOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <path d="M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
