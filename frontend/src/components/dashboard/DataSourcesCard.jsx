import { Database } from 'lucide-react'
import StatusCard from '../cards/StatusCard'

function DataSourcesCard({ items }) {
  return (
    <StatusCard
      id="data-sources-panel"
      subtitle="Connected sources"
      title="Data Sources"
    >
      <div className="space-y-2">
        {items.map((item) => (
          <div
            className="data-row flex items-center justify-between gap-2 rounded-[12px] border border-slate-800/80 bg-slate-950/45 px-3 py-2"
            key={item.id}
          >
            <span className="flex items-center gap-2 text-[12px] text-slate-300">
              <Database className="h-3.5 w-3.5 text-emerald-300" />
              {item.label}
            </span>
            <span className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[12px] text-indigo-200">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </StatusCard>
  )
}

export default DataSourcesCard
