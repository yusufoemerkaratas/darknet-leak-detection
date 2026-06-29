function StatusCard({
  title,
  subtitle,
  actionLabel,
  onAction,
  actions,
  children,
  live,
  id,
}) {
  return (
    <section
      className="panel-surface rounded-[13px] p-3 dashboard-fade-slow"
      id={id}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3
              className="section-title font-display text-[0.9rem] font-semibold"
              style={{ color: "var(--lg-text)" }}
            >
              {title}
            </h3>
            {live ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                <span className="signal-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Live
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-1 text-[10px] leading-4 text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : actionLabel ? (
          <button
            className="btn-secondary rounded-lg px-2.5 py-1 text-[10px]"
            onClick={onAction}
            type="button"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>

      {children}
    </section>
  );
}

export default StatusCard;
