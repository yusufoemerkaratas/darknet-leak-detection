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
        className={`panel-surface fixed inset-y-3 left-3 z-40 flex w-[186px] flex-col rounded-[14px] px-3 py-3.5 transition duration-300 xl:inset-y-4 xl:left-4 xl:w-[180px] ${
          isOpen ? 'translate-x-0' : '-translate-x-[120%] xl:translate-x-0'
        }`}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/25 via-violet-500/20 to-cyan-400/20 soft-ring">
              <Shield className="h-4.5 w-4.5 text-indigo-300" />
            </div>

            <div>
              <p className="font-display text-[1.25rem] font-semibold tracking-tight text-white">
                LeakGuard
              </p>
              <p className="max-w-[110px] text-[9px] leading-3.5 text-slate-400">
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
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_0_30px_rgba(99,102,241,0.25)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`}
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                <span className="text-[11px] font-medium">{item.label}</span>
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
            <section className="panel-muted rounded-[12px] p-2.5">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="signal-dot h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="font-medium uppercase tracking-[0.16em] text-slate-300">
                  Live Monitoring
                </span>
              </div>
            </section>
          ) : null}
        </div>
      </aside>
    </>
  )
}

export default Sidebar
