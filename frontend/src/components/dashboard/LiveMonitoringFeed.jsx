import { useState } from 'react'
import StatusCard from '../cards/StatusCard'

function LiveMonitoringFeed({ items, searchValue }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const visibleItems = isExpanded ? items : items.slice(0, 4)

  return (
    <StatusCard
      id="monitoring-feed"
      live
      subtitle="Streaming detections"
      title="Live Monitoring Feed"
    >
      <div className="space-y-2.5">
        {items.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-slate-800 bg-slate-950/35 px-3 py-3 text-[11px] text-slate-400">
            {searchValue?.trim()
              ? `No feed events matched "${searchValue.trim()}".`
              : 'No feed events available right now.'}
          </div>
        ) : null}

        {visibleItems.map((item) => (
          <div
            className="data-row flex items-start justify-between gap-3 rounded-[12px] border border-slate-800/80 bg-slate-950/45 p-2.5"
            key={item.id}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className={`signal-dot h-2 w-2 rounded-full ${item.tone}`} />
                <p className="text-[12px] font-medium text-white">{item.title}</p>
              </div>
              <p className="mt-1 text-[12px] text-slate-400">{item.company}</p>
            </div>

            <span className="text-[11px] text-slate-500">{item.time}</span>
          </div>
        ))}

        {items.length > 4 ? (
          <button
            className="text-[12px] font-medium text-indigo-300 transition hover:text-indigo-200"
            onClick={() => setIsExpanded((current) => !current)}
            type="button"
          >
            {isExpanded ? 'Show Less' : `View More (${items.length - 4})`}
          </button>
        ) : null}
      </div>
    </StatusCard>
  )
}

export default LiveMonitoringFeed
