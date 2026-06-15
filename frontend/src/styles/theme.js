export const severityTheme = {
  Critical: {
    badge: 'border border-[var(--badge-critical-border)] bg-[var(--badge-critical-bg)] text-[var(--badge-critical-text)]',
    dot: 'bg-[var(--badge-critical-dot)]',
    score: 'border border-[var(--badge-critical-border)] bg-[var(--badge-critical-bg)] text-[var(--badge-critical-text)]',
    chart: '#ef4444',
  },
  High: {
    badge: 'border border-[var(--badge-high-border)] bg-[var(--badge-high-bg)] text-[var(--badge-high-text)]',
    dot: 'bg-[var(--badge-high-dot)]',
    score: 'border border-[var(--badge-high-border)] bg-[var(--badge-high-bg)] text-[var(--badge-high-text)]',
    chart: '#f97316',
  },
  Medium: {
    badge: 'border border-[var(--badge-medium-border)] bg-[var(--badge-medium-bg)] text-[var(--badge-medium-text)]',
    dot: 'bg-[var(--badge-medium-dot)]',
    score: 'border border-[var(--badge-medium-border)] bg-[var(--badge-medium-bg)] text-[var(--badge-medium-text)]',
    chart: '#f59e0b',
  },
  Low: {
    badge: 'border border-[var(--badge-low-border)] bg-[var(--badge-low-bg)] text-[var(--badge-low-text)]',
    dot: 'bg-[var(--badge-low-dot)]',
    score: 'border border-[var(--badge-low-border)] bg-[var(--badge-low-bg)] text-[var(--badge-low-text)]',
    chart: '#34d399',
  },
  Info: {
    badge: 'border border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-text)]',
    dot: 'bg-[var(--badge-info-dot)]',
    score: 'border border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-text)]',
    chart: '#38bdf8',
  },
}

export const statusTheme = {
  'Not Reviewed': 'border border-[var(--status-not-reviewed-border)] bg-[var(--status-not-reviewed-bg)] text-[var(--status-not-reviewed-text)]',
  Reviewed: 'border border-[var(--status-reviewed-border)] bg-[var(--status-reviewed-bg)] text-[var(--status-reviewed-text)]',
  'False Positive': 'border border-[var(--status-false-positive-border)] bg-[var(--status-false-positive-bg)] text-[var(--status-false-positive-text)]',
  Escalated: 'border border-[var(--status-escalated-border)] bg-[var(--status-escalated-bg)] text-[var(--status-escalated-text)]',
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
