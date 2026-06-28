function DetectionGaugeChart({ label = "Analysis Coverage", value }) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 80;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const formattedValue = Number.isInteger(clamped)
    ? clamped
    : clamped.toFixed(1);

  return (
    <div className="relative flex items-center justify-center">
      <svg className="h-28 w-full max-w-[150px]" viewBox="0 0 200 120">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="var(--lg-accent)" />
            <stop offset="58%" stopColor="#8ba88f" />
            <stop offset="100%" stopColor="#c6a15d" />
          </linearGradient>
        </defs>

        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="var(--lg-chart-track)"
          strokeLinecap="round"
          strokeWidth="16"
        />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="16"
        />
      </svg>

      <div className="absolute top-[38%] text-center">
        <p className="font-display text-[1.22rem] font-semibold text-white">
          {formattedValue}%
        </p>
        <p className="text-[10px] text-slate-400">{label}</p>
        <p className="mt-0.5 text-[9px] text-slate-500">
          Stable pipeline health
        </p>
      </div>
    </div>
  );
}

export default DetectionGaugeChart;
