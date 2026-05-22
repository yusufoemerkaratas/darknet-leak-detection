import { ExternalLink, X } from 'lucide-react'
import { getSeverityTheme, getStatusTheme } from '../../styles/theme'

const statusOptions = ['Reviewing', 'Reviewed', 'False Positive']

function FindingDetailModal({
  finding,
  isLoading,
  error,
  isUpdatingStatus,
  onClose,
  onStatusChange,
}) {
  if (!finding && !isLoading && !error) return null

  const severityTone = finding ? getSeverityTheme(finding.severity) : null
  const statusTone = finding ? getStatusTheme(finding.status) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="panel-surface max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-[20px] border border-slate-800/90 p-4 sm:p-5"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Threat Analysis
            </p>
            <h2 className="mt-1 font-display text-[1.15rem] font-semibold text-white">
              {finding?.company ?? 'Loading finding'}
            </h2>
            {finding ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${severityTone?.badge}`}
                >
                  {finding.severity}
                </span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusTone}`}
                >
                  {finding.status}
                </span>
              </div>
            ) : null}
          </div>

          <button
            className="rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-slate-300 transition hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="rounded-[14px] border border-slate-800 bg-slate-950/45 px-4 py-8 text-center text-[12px] text-slate-400">
            Loading finding detail...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[14px] border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-[12px] text-rose-200">
            {error}
          </div>
        ) : null}

        {finding ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[14px] border border-slate-800 bg-slate-950/45 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Type</p>
                <p className="mt-1 text-[12px] text-slate-100">{finding.type}</p>
              </div>
              <div className="rounded-[14px] border border-slate-800 bg-slate-950/45 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Risk Score</p>
                <p className="mt-1 text-[12px] text-slate-100">{finding.riskScore}</p>
              </div>
              <div className="rounded-[14px] border border-slate-800 bg-slate-950/45 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Detected</p>
                <p className="mt-1 text-[12px] text-slate-100">{finding.detectedAt}</p>
              </div>
              <div className="rounded-[14px] border border-slate-800 bg-slate-950/45 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Source</p>
                <p className="mt-1 text-[12px] text-slate-100">{finding.source}</p>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[1.35fr_0.95fr]">
              <div className="space-y-3">
                <div className="rounded-[14px] border border-slate-800 bg-slate-950/45 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Finding Title</p>
                  <p className="mt-1 text-[13px] font-medium text-slate-100">{finding.title}</p>
                </div>

                <div className="rounded-[14px] border border-slate-800 bg-slate-950/45 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">AI Threat Explanation</p>
                  <p className="mt-2 text-[12px] leading-6 text-slate-300">{finding.summary}</p>
                </div>

                <div className="rounded-[14px] border border-slate-800 bg-slate-950/45 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Recommended Action</p>
                  <p className="mt-2 text-[12px] leading-6 text-slate-300">
                    {finding.recommendedAction}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-[14px] border border-slate-800 bg-slate-950/45 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Scope</p>
                  <p className="mt-2 text-[12px] text-slate-300">{finding.affected}</p>
                  {finding.publishedAt ? (
                    <p className="mt-2 text-[11px] text-slate-500">Published: {finding.publishedAt}</p>
                  ) : null}
                  {finding.rawUrl ? (
                    <a
                      className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-cyan-300 transition hover:text-cyan-200"
                      href={finding.rawUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View source link
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>

                <div className="rounded-[14px] border border-slate-800 bg-slate-950/45 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Evidence</p>
                  <div className="mt-2 space-y-2">
                    {finding.evidence.map((item) => (
                      <div
                        className="rounded-xl border border-slate-800 bg-slate-950/70 px-2.5 py-2 text-[11px] text-slate-300"
                        key={item}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[14px] border border-slate-800 bg-slate-950/45 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Review Actions</p>
                  <div className="mt-3 grid gap-2">
                    {statusOptions.map((status) => (
                      <button
                        className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-left text-[11px] text-slate-200 transition hover:border-cyan-400/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isUpdatingStatus || finding.status === status}
                        key={status}
                        onClick={() => onStatusChange(status)}
                        type="button"
                      >
                        {isUpdatingStatus && finding.status !== status ? `Set ${status}` : `Set ${status}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default FindingDetailModal
