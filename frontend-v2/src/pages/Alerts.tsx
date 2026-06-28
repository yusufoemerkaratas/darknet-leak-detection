import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { alertsApi, findingsApi } from '../api/client'
import type { Alert } from '../types'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { SkeletonTableRows } from '../components/ui/Skeleton'

const SEV_COLOR: Record<string, { border: string; badge: 'danger' | 'warning' | 'info' | 'default'; dot: string }> = {
  CRITICAL: { border: 'border-l-red-500',   badge: 'danger',  dot: 'bg-red-500' },
  MEDIUM:   { border: 'border-l-amber-500', badge: 'warning', dot: 'bg-amber-500' },
  LOW:      { border: 'border-l-blue-500',  badge: 'info',    dot: 'bg-blue-500' },
}

function sevKey(s: string) { return s.toUpperCase() }

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

type StatusFilter = 'all' | 'open' | 'reviewed'
type SevFilter   = 'all' | 'CRITICAL' | 'MEDIUM' | 'LOW'

// ─── Finding detail modal ────────────────────────────────────────────────────

function FindingModal({ alert, onClose }: { alert: Alert; onClose: () => void }) {
  const { data: finding, isLoading } = useQuery({
    queryKey: ['finding-detail', alert.leak_record_id],
    queryFn: () => findingsApi.get(alert.leak_record_id),
    staleTime: 60_000,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const sk  = sevKey(alert.severity)
  const col = SEV_COLOR[sk] ?? { border: 'border-l-[var(--border)]', badge: 'default' as const, dot: 'bg-[var(--text-muted)]' }

  const scoreColor =
    alert.risk_score >= 90 ? 'text-red-400' :
    alert.risk_score >= 75 ? 'text-amber-400' : 'text-blue-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl bg-[var(--card)] border border-[var(--border)] border-l-4 ${col.border} shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
              <Badge variant={col.badge}>{alert.severity}</Badge>
              {alert.classification && (
                <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider border border-[var(--border)] rounded px-1.5 py-0.5">
                  {alert.classification}
                </span>
              )}
              <span className={`text-sm font-black tabular-nums ml-auto ${scoreColor}`}>
                {alert.risk_score}
              </span>
            </div>
            <h2 className="text-sm font-semibold text-[var(--text)] leading-snug">
              {alert.finding_title ?? '—'}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{alert.company}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors p-1"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {isLoading ? (
            <div className="space-y-3">
              {[200, 140, 180].map((w) => (
                <div key={w} className={`h-4 rounded bg-[var(--surface)] animate-pulse w-[${w}px]`} />
              ))}
            </div>
          ) : finding ? (
            <>
              {/* URL — most important */}
              <div>
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                  Source URL
                </p>
                {finding.raw_url ? (
                  <div className="flex items-start gap-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5 text-[var(--primary)]">
                      <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                      <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                    </svg>
                    <a
                      href={finding.raw_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-[var(--primary)] hover:underline break-all leading-relaxed"
                    >
                      {finding.raw_url}
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] italic">No URL recorded for this finding.</p>
                )}
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Risk Score',      value: finding.risk_score, className: scoreColor + ' font-black text-lg' },
                  { label: 'Classification',  value: finding.classification ?? '—' },
                  { label: 'Severity',        value: finding.severity ?? alert.severity },
                  { label: 'Company',         value: finding.company ?? alert.company },
                  { label: 'Detected',        value: finding.created_at ? new Date(finding.created_at).toLocaleDateString() : '—' },
                  {
                    label: 'Status',
                    value: finding.is_false_positive ? 'False Positive' : finding.is_reviewed ? 'Reviewed' : 'Pending',
                  },
                ].map(({ label, value, className }) => (
                  <div key={label} className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</p>
                    <p className={`text-sm font-medium text-[var(--text)] ${className ?? ''}`}>{String(value)}</p>
                  </div>
                ))}
              </div>

              {/* Analysis classification rule */}
              {finding.analysis_result?.classification_rule && (
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Analysis</p>
                  <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-3 py-2.5">
                    <p className="text-xs text-[var(--text)] leading-relaxed">{finding.analysis_result.classification_rule}</p>
                  </div>
                </div>
              )}

              {/* Terminology hits */}
              {finding.analysis_result?.terminology_hits && finding.analysis_result.terminology_hits.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                    Terminology Hits ({finding.analysis_result.terminology_hits.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {finding.analysis_result.terminology_hits.slice(0, 20).map((hit, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-mono font-medium px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]"
                        title={`${hit.priority} · ${hit.count}×`}
                      >
                        {hit.term}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched companies */}
              {finding.analysis_result?.matched_companies && finding.analysis_result.matched_companies.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                    Matched Companies
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {finding.analysis_result.matched_companies.map((c, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium px-2 py-0.5 rounded border border-[var(--primary)]/30 bg-[var(--primary)]/5 text-[var(--primary)]"
                        title={`${c.match_type} · ${c.matched_term}`}
                      >
                        {c.company_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Review notes */}
              {alert.review_notes && (
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Review Note</p>
                  <div className="rounded-lg bg-[var(--success)]/5 border border-[var(--success)]/20 px-3 py-2.5">
                    <p className="text-xs text-[var(--text)] leading-relaxed">{alert.review_notes}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Could not load finding details.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewForm({ alertId, onDone }: { alertId: number; onDone: () => void }) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')

  const mutation = useMutation({
    mutationFn: () => alertsApi.markReviewed(alertId, note.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      onDone()
    },
  })

  return (
    <div className="px-5 py-3 bg-[var(--surface)] border-t border-[var(--border)]">
      <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">
        Review note <span className="font-normal normal-case opacity-60">(optional)</span>
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Why is this reviewed? Add context for your team…"
        rows={2}
        autoFocus
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--text)] placeholder:text-[var(--text-muted)] text-sm px-3 py-2 resize-none focus:outline-none focus:border-[var(--primary)] transition-colors"
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? 'Saving…' : 'Confirm review'}
        </button>
        <button
          onClick={onDone}
          disabled={mutation.isPending}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export function Alerts() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sevFilter, setSevFilter] = useState<SevFilter>('all')
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)

  const { data: page, isLoading } = useQuery({
    queryKey: ['alerts', statusFilter, sevFilter],
    queryFn: () => alertsApi.list({
      is_reviewed: statusFilter === 'open' ? false : statusFilter === 'reviewed' ? true : undefined,
      severity:    sevFilter !== 'all' ? sevFilter : undefined,
    }),
    refetchInterval: 15_000,
  })

  const alerts: Alert[] = page?.items ?? []
  const serverTotal = page?.total ?? 0

  const resetMutation = useMutation({
    mutationFn: (id: number) => alertsApi.resetAlert(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const { data: allPage } = useQuery({
    queryKey: ['alerts', 'summary'],
    queryFn: () => alertsApi.list({ size: 100 }),
    refetchInterval: 15_000,
  })
  const allAlerts     = allPage?.items ?? []
  const openCount     = allAlerts.filter((a) => !a.is_reviewed).length
  const criticalCount = allAlerts.filter((a) => sevKey(a.severity) === 'CRITICAL').length
  const totalCount    = allPage?.total ?? 0

  const sorted = useMemo(() =>
    [...alerts].sort((a, b) => {
      const order = ['CRITICAL', 'MEDIUM', 'LOW']
      const ai = order.indexOf(sevKey(a.severity))
      const bi = order.indexOf(sevKey(b.severity))
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }), [alerts])

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
      active
        ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
        : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
    }`

  return (
    <>
    {selectedAlert && (
      <FindingModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    )}
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">Security Alerts</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Auto-generated alerts from high-risk findings
          </p>
        </div>
      </div>

      {/* Stat bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
          <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">Total</p>
          <p className="text-2xl font-bold text-[var(--text)]">{totalCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
          <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">Open</p>
          <p className="text-2xl font-bold text-amber-500">{openCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
          <p className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">Critical</p>
          <p className="text-2xl font-bold text-red-500">{criticalCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 rounded-lg bg-[var(--surface)]">
          {(['all', 'open', 'reviewed'] as StatusFilter[]).map((s) => (
            <button key={s} className={tabClass(statusFilter === s)} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'All' : s === 'open' ? 'Open' : 'Reviewed'}
              {statusFilter === s && serverTotal > 0 && ` (${serverTotal})`}
            </button>
          ))}
        </div>

        <div className="flex gap-1 p-1 rounded-lg bg-[var(--surface)]">
          {(['all', 'CRITICAL', 'MEDIUM', 'LOW'] as SevFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setSevFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                sevFilter === s
                  ? s === 'CRITICAL' ? 'bg-red-500/10 text-red-400'
                    : s === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400'
                    : s === 'LOW'    ? 'bg-blue-500/10 text-blue-400'
                    : 'bg-[var(--primary)]/10 text-[var(--primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--card)]'
              }`}
            >
              {s === 'all' ? 'All severity' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        {!isLoading && sorted.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-[var(--text-muted)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-10 h-10 mb-3 opacity-30">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
            <p className="text-sm font-medium">No alerts found</p>
            <p className="text-xs mt-1 opacity-60">
              {statusFilter !== 'all' || sevFilter !== 'all'
                ? 'Try adjusting your filters.'
                : 'No threat alerts have been generated yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Severity</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Finding</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Company</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Detected</th>
                  <th className="w-32" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <SkeletonTableRows rows={5} widths={['w-16', 'w-2/5', 'w-28', 'w-20', 'w-24', 'w-16']} />
                ) : sorted.map((alert) => {
                  const sk  = sevKey(alert.severity)
                  const col = SEV_COLOR[sk] ?? { border: 'border-l-[var(--border)]', badge: 'default' as const, dot: 'bg-[var(--text-muted)]' }
                  const isReviewing = reviewingId === alert.id

                  return (
                    <>
                      <tr
                        key={alert.id}
                        className={`border-b ${isReviewing ? 'border-[var(--primary)]/20' : 'border-[var(--border)] last:border-0'} border-l-2 ${col.border} hover:bg-[var(--surface)] transition-colors cursor-pointer`}
                        onClick={() => setSelectedAlert(alert)}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${col.dot}`} />
                            <Badge variant={col.badge}>{alert.severity}</Badge>
                          </div>
                        </td>
                        <td className="px-5 py-3 max-w-xs">
                          <p className="font-medium text-[var(--text)] truncate" title={alert.finding_title ?? ''}>
                            {alert.finding_title ?? '—'}
                          </p>
                          {alert.classification && (
                            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 capitalize">
                              {alert.classification}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-[var(--text-muted)] whitespace-nowrap">
                          {alert.company ?? '—'}
                        </td>
                        <td className="px-5 py-3">
                          {alert.is_reviewed ? (
                            <div>
                              <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--success)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                                Reviewed
                              </span>
                              {alert.review_notes && (
                                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 max-w-[180px] truncate" title={alert.review_notes}>
                                  {alert.review_notes}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs text-amber-500 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Open
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                          <span title={new Date(alert.created_at).toLocaleString()}>
                            {timeAgo(alert.created_at)}
                          </span>
                          <p className="text-[10px] opacity-60 mt-0.5">
                            {new Date(alert.created_at).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {alert.is_reviewed ? (
                            <button
                              onClick={() => resetMutation.mutate(alert.id)}
                              disabled={resetMutation.isPending && resetMutation.variables === alert.id}
                              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-amber-400 hover:border-amber-500/40 disabled:opacity-40 transition-colors whitespace-nowrap"
                            >
                              {resetMutation.isPending && resetMutation.variables === alert.id
                                ? 'Saving…'
                                : 'Revert to open'}
                            </button>
                          ) : (
                            <button
                              onClick={() => setReviewingId(isReviewing ? null : alert.id)}
                              className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap ${
                                isReviewing
                                  ? 'border-[var(--primary)]/40 bg-[var(--primary)]/8 text-[var(--primary)]'
                                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--primary)]/40'
                              }`}
                            >
                              {isReviewing ? 'Cancel' : 'Mark reviewed'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isReviewing && (
                        <tr key={`${alert.id}-form`} className={`border-b border-[var(--border)] border-l-2 ${col.border}`}>
                          <td colSpan={6} className="p-0">
                            <ReviewForm alertId={alert.id} onDone={() => setReviewingId(null)} />
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
    </>
  )
}
