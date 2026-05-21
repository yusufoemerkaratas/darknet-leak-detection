import StatusCard from '../cards/StatusCard'

const legendItems = [
  { label: 'Critical', range: '90 - 100', dot: 'bg-rose-400' },
  { label: 'High', range: '70 - 89', dot: 'bg-orange-400' },
  { label: 'Medium', range: '40 - 69', dot: 'bg-amber-400' },
  { label: 'Low', range: '1 - 39', dot: 'bg-emerald-400' },
  { label: 'Info', range: 'Informational', dot: 'bg-sky-400' },
]

function SeverityLegend() {
  return (
    <StatusCard subtitle="Score thresholds" title="Severity Legend">
      <div className="space-y-2">
        {legendItems.map((item) => (
          <div className="flex items-center justify-between gap-3 text-[12px]" key={item.label}>
            <span className="flex items-center gap-2.5 text-slate-300">
              <span className={`signal-dot h-2 w-2 rounded-full ${item.dot}`} />
              {item.label}
            </span>
            <span className="text-slate-500">{item.range}</span>
          </div>
        ))}
      </div>
    </StatusCard>
  )
}

export default SeverityLegend
