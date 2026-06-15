export const severityTheme = {
  Critical: {
    badge: 'border border-rose-500/25 bg-rose-500/12 text-rose-200',
    dot: 'bg-rose-400',
    score: 'border border-rose-500/25 bg-rose-500/12 text-rose-200',
    chart: '#ef4444',
  },
  High: {
    badge: 'border border-orange-500/25 bg-orange-500/12 text-orange-200',
    dot: 'bg-orange-400',
    score: 'border border-orange-500/25 bg-orange-500/12 text-orange-200',
    chart: '#f97316',
  },
  Medium: {
    badge: 'border border-amber-500/25 bg-amber-500/12 text-amber-200',
    dot: 'bg-amber-400',
    score: 'border border-amber-500/25 bg-amber-500/12 text-amber-200',
    chart: '#f59e0b',
  },
  Low: {
    badge: 'border border-emerald-500/25 bg-emerald-500/12 text-emerald-200',
    dot: 'bg-emerald-400',
    score: 'border border-emerald-500/25 bg-emerald-500/12 text-emerald-200',
    chart: '#34d399',
  },
  Info: {
    badge: 'border border-sky-500/25 bg-sky-500/12 text-sky-200',
    dot: 'bg-sky-400',
    score: 'border border-sky-500/25 bg-sky-500/12 text-sky-200',
    chart: '#38bdf8',
  },
}

export const statusTheme = {
  'Not Reviewed': 'border border-amber-500/20 bg-amber-500/10 text-amber-200',
  Reviewed: 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  'False Positive': 'border border-sky-500/20 bg-sky-500/10 text-sky-200',
  Escalated: 'border border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200',
}

export function getSeverityTheme(severity) {
  return severityTheme[severity] ?? severityTheme.Info
}

export function getStatusTheme(status) {
  return statusTheme[status] ?? 'border border-slate-700 bg-slate-800/70 text-slate-200'
}

export const theme = {
  bg: '#0b0f12', // matte black background
  surface: '#0f1720',
  card: '#0c1114',
  text: '#e6eef6',
  muted: '#98a2b3',
  accent: '#38bdf8', // neon-blue accent (soft)
  accentMuted: '#2b9fdc',
  success: '#34d399',
  warning: '#f59e0b',
  danger: '#ef4444',
  glass: 'rgba(255,255,255,0.03)',
}
