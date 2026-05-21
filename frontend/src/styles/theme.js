export const severityTheme = {
  Critical: {
    badge: 'border border-rose-500/25 bg-rose-500/12 text-rose-200',
    dot: 'bg-rose-400',
    score: 'border border-rose-500/25 bg-rose-500/12 text-rose-200',
    chart: '#fb7185',
  },
  High: {
    badge: 'border border-orange-500/25 bg-orange-500/12 text-orange-200',
    dot: 'bg-orange-400',
    score: 'border border-orange-500/25 bg-orange-500/12 text-orange-200',
    chart: '#fb923c',
  },
  Medium: {
    badge: 'border border-amber-500/25 bg-amber-500/12 text-amber-200',
    dot: 'bg-amber-400',
    score: 'border border-amber-500/25 bg-amber-500/12 text-amber-200',
    chart: '#facc15',
  },
  Low: {
    badge: 'border border-emerald-500/25 bg-emerald-500/12 text-emerald-200',
    dot: 'bg-emerald-400',
    score: 'border border-emerald-500/25 bg-emerald-500/12 text-emerald-200',
    chart: '#4ade80',
  },
  Info: {
    badge: 'border border-sky-500/25 bg-sky-500/12 text-sky-200',
    dot: 'bg-sky-400',
    score: 'border border-sky-500/25 bg-sky-500/12 text-sky-200',
    chart: '#38bdf8',
  },
}

export const statusTheme = {
  New: 'border border-rose-500/20 bg-rose-500/10 text-rose-200',
  Reviewing: 'border border-amber-500/20 bg-amber-500/10 text-amber-200',
  Reviewed: 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  Escalated: 'border border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200',
}

export function getSeverityTheme(severity) {
  return severityTheme[severity] ?? severityTheme.Info
}

export function getStatusTheme(status) {
  return statusTheme[status] ?? 'border border-slate-700 bg-slate-800/70 text-slate-200'
}
