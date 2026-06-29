function Sparkline({ color, points }) {
  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${index * 18} ${38 - point}`,
    )
    .join(" ");

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
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  accentClass,
  color,
  trend,
  delay,
}) {
  return (
    <div
      className={`dashboard-fade rounded-lg-card px-3 py-2.5 ${accentClass}`}
      style={{
        animationDelay: delay,
        backgroundColor: "var(--lg-card, #12191e)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div
            className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-md"
            style={{
              border: "1px solid var(--lg-control-border)",
              background: "var(--lg-control-bg)",
            }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color }} />
          </div>
          <p className="text-[10px] font-medium tracking-[0.01em] text-lg-muted">
            {label}
          </p>
          <p className="font-display mt-1 text-[1.18rem] font-semibold tracking-tight text-lg-text">
            {value}
          </p>
          {detail ? (
            <p
              className="mt-1 max-w-[112px] text-[8px] leading-3 text-lg-muted"
              style={{ opacity: 0.72, letterSpacing: "0.01em" }}
            >
              {detail}
            </p>
          ) : null}
        </div>

        <div
          className="rounded-md px-1 py-0.5"
          style={{
            border: "1px solid var(--lg-control-border)",
            background: "var(--lg-control-bg)",
          }}
        >
          <Sparkline color={color} points={trend} />
        </div>
      </div>
    </div>
  );
}

export default StatCard;
