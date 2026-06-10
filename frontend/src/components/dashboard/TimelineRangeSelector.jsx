const RANGE_OPTIONS = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '365d', label: '12M' },
]

function TimelineRangeSelector({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950/70 p-1">
      {RANGE_OPTIONS.map((option) => {
        const isActive = option.value === value

        return (
          <button
            className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition ${
              isActive
                ? 'bg-cyan-500/15 text-cyan-200'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default TimelineRangeSelector
