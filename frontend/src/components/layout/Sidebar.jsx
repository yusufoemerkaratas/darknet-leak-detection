import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  Database,
  FileText,
  LayoutDashboard,
  SearchCheck,
  Settings,
  Shield,
  X,
} from 'lucide-react'
import { navigationItems, rightPanelItems } from '../../data/mockData'

const iconMap = {
  dashboard: LayoutDashboard,
  alerts: Bell,
  findings: SearchCheck,
  companies: Building2,
  sources: Database,
  visualizations: BarChart3,
  reports: FileText,
  settings: Settings,
  'monitoring-feed': Bell,
  'severity-legend': BarChart3,
  'data-sources-panel': Database,
  'engine-status-panel': Activity,
}

function Sidebar({ activeItem, isOpen, onClose, onSelectItem, statusCards = [] }) {
  const primaryStatusCard = statusCards.find((card) => card.id === 'system-status')
  const liveMonitoringRow = primaryStatusCard?.rows.find(
    (row) => row.label === 'Live Monitoring'
  )

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition xl:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      <aside
        className={`panel-surface fixed inset-y-3 left-3 z-40 flex w-[244px] flex-col rounded-[16px] px-4 py-4 transition duration-300 xl:inset-y-4 xl:left-4 xl:w-[240px] ${
          isOpen ? 'translate-x-0' : '-translate-x-[120%] xl:translate-x-0'
        }`}
      >
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/30 via-violet-500/25 to-cyan-400/20 soft-ring">
              <Shield className="h-5 w-5 text-indigo-200" />
            </div>

            <div>
              <p className="font-display text-[1.35rem] font-semibold tracking-tight text-white">
                LeakGuard
              </p>
              <p className="max-w-[150px] text-[10px] leading-4 text-slate-400">
                AI Basics Leak Detection System
              </p>
            </div>
          </div>

          <button
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-slate-400 xl:hidden"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-0.5">
          {navigationItems.map((item) => {
            const Icon = iconMap[item.id]
            const isActive = activeItem === item.id

            return (
              <button
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_0_30px_rgba(99,102,241,0.25)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`}
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                <span className="text-[12px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="mt-4 border-t border-slate-800/80 pt-3">
          <p className="mb-2 px-2.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Right Panel
          </p>
          <div className="space-y-0.5">
            {rightPanelItems.map((item) => {
              const Icon = iconMap[item.id]
              const isActive = activeItem === item.id

              return (
                <button
                  className={`group flex w-full items-center justify-between rounded-lg border-l-2 px-2.5 py-1.5 text-left transition ${
                    isActive
                      ? 'border-cyan-400 bg-cyan-500/10 text-cyan-100'
                      : 'border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-200'
                  }`}
                  key={item.id}
                  onClick={() => onSelectItem(item.id)}
                  type="button"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </span>
                  <ArrowRight
                    className={`h-3 w-3 transition ${
                      isActive
                        ? 'translate-x-0 text-cyan-200'
                        : 'text-slate-600 group-hover:translate-x-0.5 group-hover:text-slate-300'
                    }`}
                  />
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-auto space-y-2 pt-4">
          {liveMonitoringRow ? (
            <section className="panel-muted rounded-[14px] p-3">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="signal-dot h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="font-medium uppercase tracking-[0.16em] text-slate-300">
                  Live Monitoring
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-slate-500">
                All systems operational
              </p>
            </section>
          ) : null}
          <section className="panel-muted rounded-[14px] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Detection Engine
              </p>
              <span className="signal-dot h-2 w-2 rounded-full bg-emerald-400" />
            </div>
            <div className="space-y-1.5 text-[11px] text-slate-500">
              <div className="flex justify-between gap-2">
                <span>AI Model</span>
                <span className="text-emerald-300">Active</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Data Sources</span>
                <span className="text-slate-300">Live</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Last Scan</span>
                <span className="text-slate-300">Auto</span>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
