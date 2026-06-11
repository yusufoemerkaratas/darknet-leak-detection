function DetectionGaugeChart({ label = 'Analysis Coverage', value }) {
  const clamped = Math.max(0, Math.min(100, value))
  const radius = 80
  const circumference = Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div className="relative flex items-center justify-center">
      <svg className="h-28 w-full max-w-[150px]" viewBox="0 0 200 120">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#86efac" />
          </linearGradient>
        </defs>

        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="rgba(30, 41, 59, 0.95)"
          strokeLinecap="round"
          strokeWidth="18"
        />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="18"
        />
      </svg>

      <div className="absolute top-[40%] text-center">
        <p className="font-display text-[1.45rem] font-semibold text-white">{value}%</p>
        <p className="text-[10px] text-slate-400">{label}</p>
      </div>
    </div>
  )
}

export default DetectionGaugeChart
