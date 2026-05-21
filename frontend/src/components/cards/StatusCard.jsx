function StatusCard({ title, subtitle, actionLabel, children, live, id }) {
  return (
    <section className="panel-surface rounded-[13px] p-2.5 dashboard-fade-slow" id={id}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="section-title font-display text-[0.92rem] font-semibold text-white">
              {title}
            </h3>
            {live ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                <span className="signal-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Live
              </span>
            ) : null}
          </div>
          {subtitle ? <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p> : null}
        </div>

        {actionLabel ? (
          <button
            className="rounded-lg border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-[10px] text-slate-200 transition hover:border-indigo-400/30 hover:text-white"
            type="button"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>

      {children}
    </section>
  )
}

export default StatusCard
