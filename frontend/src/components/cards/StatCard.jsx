function Sparkline({ color, points }) {
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${index * 18} ${38 - point}`)
    .join(' ')

  return (
    <svg className="h-8 w-20" viewBox="0 0 72 40" fill="none">
      <path d={path} stroke={color} strokeLinecap="round" strokeWidth="2.2" />
      <path
        d={`${path} L 72 40 L 0 40 Z`}
        fill={color}
        fillOpacity="0.12"
        stroke="none"
      />
    </svg>
  )
}

function StatCard({ icon: Icon, label, value, detail, accentClass, color, trend, delay }) {
  return (
    <div
      className={`panel-surface dashboard-fade rounded-[13px] px-3 py-2.5 ${accentClass}`}
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5">
            <Icon className="h-3.5 w-3.5" style={{ color }} />
          </div>
          <p className="truncate text-[11px] text-slate-400">{label}</p>
          <p className="font-display mt-0.5 text-[1.35rem] font-semibold tracking-tight text-white">
            {value}
          </p>
          <p className="truncate text-[10px] text-slate-500">{detail}</p>
        </div>

        <div className="rounded-md border border-white/5 bg-slate-950/50 px-1 py-0.5">
          <Sparkline color={color} points={trend} />
        </div>
      </div>
    </div>
  )
}

export default StatCard
