import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { findingsApi, dashboardApi } from '../api/client'
import type { Finding, FindingDetail } from '../types'
import { useTheme } from '../context/ThemeContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { SkeletonTableRows } from '../components/ui/Skeleton'
import { severityFromScore, severityLabel } from '../utils/severity'
import type { SeverityLevel } from '../utils/severity'
import { FindingsReportDownloadButton, FindingDetailDownloadButton } from '../components/ReportPDF'
import type { FindingsReportData, FindingDetailPdfData } from '../components/ReportPDF'

const classificationVariant: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'info',
  informational: 'default',
  irrelevant: 'default',
}

function RiskBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  const color = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-blue-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-[var(--text-muted)] w-6 text-right">{score}</span>
    </div>
  )
}

function FindingModal({
  findingId,
  onClose,
}: {
  findingId: number
  onClose: () => void
}) {
  const qc = useQueryClient()

  const { data: finding, isLoading } = useQuery<FindingDetail>({
    queryKey: ['finding', findingId],
    queryFn: () => findingsApi.get(findingId),
  })

  const [note, setNote] = useState('')

  const reviewMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      findingsApi.markReviewed(id, notes),
    onSuccess: () => {
      setNote('')
      qc.invalidateQueries({ queryKey: ['findings'] })
      qc.invalidateQueries({ queryKey: ['finding', findingId] })
    },
  })

  const fpMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      findingsApi.markReviewed(id, notes).then(() => findingsApi.markFalsePositive(id)),
    onSuccess: () => {
      setNote('')
      qc.invalidateQueries({ queryKey: ['findings'] })
      qc.invalidateQueries({ queryKey: ['finding', findingId] })
    },
  })

  const resetMutation = useMutation({
    mutationFn: (id: number) => findingsApi.resetStatus(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['findings'] })
      qc.invalidateQueries({ queryKey: ['finding', findingId] })
    },
  })

  const llmMutation = useMutation({
    mutationFn: (id: number) => findingsApi.runLlmAnalysis(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finding', findingId] })
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl bg-[var(--glass)] backdrop-blur-xl border border-[var(--glass-border)] shadow-2xl shadow-black/30">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text)]">Finding Detail</h3>
          <div className="flex items-center gap-2">
            {!isLoading && finding && (
              <FindingDetailDownloadButton data={{
                id: finding.id,
                title: finding.title,
                company: finding.company,
                classification: finding.classification,
                risk_score: finding.risk_score,
                is_reviewed: finding.is_reviewed,
                is_false_positive: finding.is_false_positive,
                review_notes: finding.review_notes,
                created_at: finding.created_at,
                raw_url: finding.raw_url,
                analysis_result: finding.analysis_result ? {
                  classification_rule: finding.analysis_result.classification_rule,
                  matched_companies: finding.analysis_result.matched_companies,
                  terminology_hits: finding.analysis_result.terminology_hits,
                  score_contributors: finding.analysis_result.score_contributors,
                } : null,
              } satisfies FindingDetailPdfData} />
            )}
            <button
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        </div>

        {isLoading || !finding ? (
          <div className="flex items-center justify-center py-16">
            <PageLoader />
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Title + badges */}
            <div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <Badge variant={classificationVariant[finding.classification] ?? 'default'}>
                  {finding.classification}
                </Badge>
                <Badge variant={severityFromScore(finding.risk_score) === 'critical' ? 'danger' : severityFromScore(finding.risk_score) === 'medium' ? 'warning' : 'info'}>
                  {severityLabel(finding.risk_score)}
                </Badge>
                {finding.is_false_positive && <Badge variant="default">False Positive</Badge>}
                {finding.is_reviewed && !finding.is_false_positive && (
                  <Badge variant="success">Reviewed</Badge>
                )}
              </div>
              <h4 className="text-base font-semibold text-[var(--text)]">{finding.title}</h4>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Company: {finding.company} · Detected: {new Date(finding.created_at).toLocaleString()}
              </p>
            </div>

            {/* Review / FP note — shown prominently right after title */}
            {finding.review_notes && (
              <div className="rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-4 py-3 flex gap-3">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5 text-[var(--primary)] opacity-70">
                  <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-xs font-semibold text-[var(--primary)] mb-1">
                    {finding.is_false_positive ? 'False Positive Note' : 'Review Note'}
                  </p>
                  <p className="text-sm text-[var(--text)] leading-relaxed">{finding.review_notes}</p>
                </div>
              </div>
            )}

            {/* Source URL */}
            {finding.raw_url && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">Source URL</p>
                <a
                  href={finding.raw_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 break-all transition-colors"
                >
                  {finding.raw_url}
                </a>
              </div>
            )}

            {/* Risk score */}
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Risk Score</p>
              <RiskBar score={finding.risk_score} />
            </div>

            {/* Analysis result */}
            {finding.analysis_result && (
              <>
                {finding.analysis_result.classification_rule && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Analysis</p>
                    <p className="text-sm text-[var(--text)] bg-[var(--surface)] rounded-lg px-3 py-2.5 leading-relaxed">
                      {finding.analysis_result.classification_rule}
                    </p>
                  </div>
                )}

                {/* LLM Analysis */}
                <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--surface)] border-b border-[var(--border)]">
                    <div className="flex items-center gap-2">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-[var(--primary)]">
                        <path d="M10 1a6 6 0 0 1 3.762 10.73l-.98.98a1 1 0 0 1-.707.293H7.925a1 1 0 0 1-.707-.293l-.98-.98A6 6 0 0 1 10 1ZM7 15v-1h6v1a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1Zm2.5 2v-1h1v1a.5.5 0 0 1-1 0Z" />
                      </svg>
                      <span className="text-xs font-semibold text-[var(--text)]">Detailed AI Analysis</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] font-medium">Ollama</span>
                    </div>
                    {!finding.analysis_result.detected_patterns?.llm_enrichment?.explanation && (
                      <button
                        onClick={() => llmMutation.mutate(finding.id)}
                        disabled={llmMutation.isPending}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-wait transition-colors"
                      >
                        {llmMutation.isPending ? (
                          <>
                            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            Analyzing…
                          </>
                        ) : (
                          <>
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd"/>
                            </svg>
                            Run Analysis
                          </>
                        )}
                      </button>
                    )}
                    {finding.analysis_result.detected_patterns?.llm_enrichment?.explanation && (
                      <button
                        onClick={() => llmMutation.mutate(finding.id)}
                        disabled={llmMutation.isPending}
                        className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                      >
                        {llmMutation.isPending ? 'Running…' : 'Re-run'}
                      </button>
                    )}
                  </div>
                  <div className="px-3 py-3">
                    {finding.analysis_result.detected_patterns?.llm_enrichment?.explanation ? (
                      <>
                        <p className="text-sm text-[var(--text)] leading-relaxed">
                          {finding.analysis_result.detected_patterns.llm_enrichment.explanation}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-2">
                          Model: {finding.analysis_result.detected_patterns.llm_enrichment.model}
                        </p>
                      </>
                    ) : llmMutation.isError ? (
                      <p className="text-xs text-red-400">AI analysis failed. Ollama may not be available.</p>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)] italic">
                        Run a detailed AI-powered threat analysis for this finding.
                      </p>
                    )}
                  </div>
                </div>

                {finding.analysis_result.matched_companies.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Matched Companies</p>
                    <div className="flex flex-wrap gap-1.5">
                      {finding.analysis_result.matched_companies.map((c, i) => (
                        <span
                          key={`${c.company_name}-${i}`}
                          title={`${c.match_type} · ${c.matched_term}`}
                          className="px-2 py-0.5 rounded text-xs bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]"
                        >
                          {c.company_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {finding.analysis_result.terminology_hits.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Terminology Hits</p>
                    <div className="flex flex-wrap gap-1.5">
                      {finding.analysis_result.terminology_hits.map((h) => (
                        <span
                          key={h.term}
                          title={`priority: ${h.priority} · count: ${h.count}`}
                          className="px-2 py-0.5 rounded text-xs font-mono bg-[var(--surface)] text-[var(--primary)] border border-[var(--border)]"
                        >
                          {h.term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Score contributors */}
                {Object.keys(finding.analysis_result.score_contributors).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Score Breakdown</p>
                    <div className="space-y-1.5">
                      {Object.entries(finding.analysis_result.score_contributors)
                        .filter(([, v]) => v !== 0)
                        .map(([key, val]) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-xs text-[var(--text-muted)] w-48 shrink-0 capitalize">
                              {key.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs font-semibold tabular-nums text-[var(--text)] w-8 text-right">{val}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Move to Pending */}
            {(finding.is_reviewed || finding.is_false_positive) && (
              <div className="pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => resetMutation.mutate(finding.id)}
                  loading={resetMutation.isPending}
                >
                  Move to Pending
                </Button>
              </div>
            )}

            {/* Actions */}
            {!finding.is_reviewed && !finding.is_false_positive && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">
                    Note <span className="font-normal normal-case opacity-60">(optional)</span>
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Why are you marking this? Add context for your team…"
                    rows={3}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-muted)] text-sm px-3 py-2 resize-none focus:outline-none focus:border-[var(--primary)] transition-colors"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => reviewMutation.mutate({ id: finding.id, notes: note || undefined })}
                    loading={reviewMutation.isPending}
                  >
                    Mark as Reviewed
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fpMutation.mutate({ id: finding.id, notes: note || undefined })}
                    loading={fpMutation.isPending}
                  >
                    False Positive
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

type SortKey = 'title' | 'company' | 'classification' | 'status' | 'risk_score' | 'created_at'

function SortTh({
  label, col, sortKey, sortDir, onSort, className,
}: {
  label: string
  col: SortKey
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (col: SortKey) => void
  className?: string
}) {
  const active = sortKey === col
  return (
    <th className={`text-left px-5 py-3 ${className ?? ''}`}>
      <button
        onClick={() => onSort(col)}
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors whitespace-nowrap ${
          active ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
        }`}
      >
        {label}
        <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 transition-opacity ${active ? 'opacity-100' : 'opacity-30'}`}>
          {active && sortDir === 'asc'
            ? <path d="M8 3.5a.5.5 0 0 1 .5.5v6.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.793V4a.5.5 0 0 1 .5-.5Z" transform="rotate(180 8 8)" />
            : active && sortDir === 'desc'
            ? <path d="M8 3.5a.5.5 0 0 1 .5.5v6.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.793V4a.5.5 0 0 1 .5-.5Z" />
            : <path d="M5.854 4.646a.5.5 0 0 0-.708 0l-2 2a.5.5 0 0 0 .708.708L5 6.207V11.5a.5.5 0 0 0 1 0V6.207l1.146 1.147a.5.5 0 1 0 .708-.708l-2-2Zm5 .708L12.146 6.5a.5.5 0 0 0 .708-.708l-2-2a.5.5 0 0 0-.708 0l-2 2a.5.5 0 0 0 .708.708L10 5.207V10.5a.5.5 0 0 0 1 0V5.207l1.146 1.147Z" />
          }
        </svg>
      </button>
    </th>
  )
}

const SEV_OPTIONS: { key: SeverityLevel; label: string; range: string }[] = [
  { key: 'critical', label: 'Critical', range: '≥ 90' },
  { key: 'medium',   label: 'Medium',   range: '75–89' },
  { key: 'low',      label: 'Low',      range: '< 75' },
]

export function Findings() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed' | 'false_positive'>('all')
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [selectedSeverities, setSelectedSeverities] = useState<Set<SeverityLevel>>(new Set())

  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (col: SortKey) => {
    if (col === sortKey) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('asc') }
  }

  const [companySearch, setCompanySearch] = useState('')

  const [companyMenuOpen, setCompanyMenuOpen] = useState(false)
  const [companyMenuRect, setCompanyMenuRect] = useState<DOMRect | null>(null)
  const companyBtnRef = useRef<HTMLButtonElement>(null)
  const companyDropRef = useRef<HTMLDivElement>(null)

  const [sevMenuOpen, setSevMenuOpen] = useState(false)
  const [sevMenuRect, setSevMenuRect] = useState<DOMRect | null>(null)
  const sevBtnRef = useRef<HTMLButtonElement>(null)
  const sevDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (companyMenuOpen &&
          !companyBtnRef.current?.contains(t) &&
          !companyDropRef.current?.contains(t)) {
        setCompanyMenuOpen(false)
        setCompanySearch('')
      }
      if (sevMenuOpen &&
          !sevBtnRef.current?.contains(t) &&
          !sevDropRef.current?.contains(t)) {
        setSevMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [companyMenuOpen, sevMenuOpen])

  const PAGE_SIZE = 50
  const [currentPage, setCurrentPage] = useState(1)

  // Map status tab to server-side filter params
  const filterOpts = useMemo(() => {
    if (filter === 'pending')        return { is_reviewed: false, is_false_positive: false }
    if (filter === 'reviewed')       return { is_reviewed: true,  is_false_positive: false }
    if (filter === 'false_positive') return { is_false_positive: true }
    return undefined
  }, [filter])

  useEffect(() => setCurrentPage(1), [filter])

  const { data: page, isLoading } = useQuery({
    queryKey: ['findings', currentPage, filter],
    queryFn: () => findingsApi.list(currentPage, PAGE_SIZE, filterOpts),
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  })

  const findings: Finding[] = page?.items ?? []
  const serverTotal = page?.total ?? 0

  const allCompanies = useMemo(
    () => [...new Set(findings.map((f) => f.company).filter(Boolean))].sort() as string[],
    [findings],
  )

  // Client-side company + severity filter applied to the current page results
  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (selectedCompanies.size > 0 && !selectedCompanies.has(f.company ?? '')) return false
      if (selectedSeverities.size > 0 && !selectedSeverities.has(severityFromScore(f.risk_score))) return false
      return true
    })
  }, [findings, selectedCompanies, selectedSeverities])

  // Client-side sort within current page
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string | number
      let vb: string | number
      if (sortKey === 'title') { va = a.title.toLowerCase(); vb = b.title.toLowerCase() }
      else if (sortKey === 'company') { va = (a.company ?? '').toLowerCase(); vb = (b.company ?? '').toLowerCase() }
      else if (sortKey === 'classification') { va = a.classification.toLowerCase(); vb = b.classification.toLowerCase() }
      else if (sortKey === 'status') {
        const sv = (f: typeof a) => (f as Finding & { is_false_positive?: boolean }).is_false_positive ? 2 : (f as Finding & { is_reviewed?: boolean }).is_reviewed ? 1 : 0
        va = sv(a); vb = sv(b)
      }
      else if (sortKey === 'risk_score') { va = a.risk_score; vb = b.risk_score }
      else { va = new Date(a.created_at).getTime(); vb = new Date(b.created_at).getTime() }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.ceil(serverTotal / PAGE_SIZE)
  const pagedFindings = sorted

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
      active
        ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
        : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
    }`

  const filterLabel =
    filter === 'pending' ? 'Pending' :
    filter === 'reviewed' ? 'Reviewed' :
    filter === 'false_positive' ? 'False Positives' : 'All findings'

  const reportData = useMemo<FindingsReportData | null>(() => {
    if (!sorted.length) return null
    return {
      generatedAt: new Date().toISOString(),
      filterLabel,
      filters: {
        companies: [...selectedCompanies],
        severities: [...selectedSeverities],
      },
      findings: sorted.map((f) => ({
        id: f.id,
        title: f.title,
        company: f.company ?? 'Unknown',
        classification: f.classification,
        risk_score: f.risk_score,
        is_reviewed: (f as Finding & { is_reviewed?: boolean }).is_reviewed ?? false,
        is_false_positive: (f as Finding & { is_false_positive?: boolean }).is_false_positive ?? false,
        created_at: f.created_at,
      })),
    }
  }, [sorted, filterLabel, selectedCompanies, selectedSeverities])

  return (
    <>
      {selectedId !== null && (
        <FindingModal findingId={selectedId} onClose={() => setSelectedId(null)} />
      )}

      {/* Company dropdown portal */}
      {companyMenuOpen && companyMenuRect && createPortal(
        <div
          ref={companyDropRef}
          style={{
            position: 'fixed',
            top: companyMenuRect.bottom + 6,
            right: window.innerWidth - companyMenuRect.right,
            zIndex: 99999,
            width: 220,
            maxHeight: 320,
            background: isDark ? '#0c1219' : '#ffffff',
            borderRadius: 12,
            border: `1px solid ${isDark ? 'rgba(30,50,72,0.6)' : 'rgba(180,200,235,0.5)'}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${isDark ? '#152030' : '#e2e8f0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>Filter by Company</span>
            <button
              onClick={() => setSelectedCompanies(new Set())}
              style={{ fontSize: 10, color: isDark ? '#3b82f6' : '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Clear all
            </button>
          </div>
          <div style={{ padding: '8px 12px', borderBottom: `1px solid ${isDark ? '#152030' : '#e2e8f0'}` }}>
            <div style={{ position: 'relative' }}>
              <svg viewBox="0 0 16 16" fill="currentColor" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: isDark ? '#4a6580' : '#94a3b8', pointerEvents: 'none' }}>
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
              </svg>
              <input
                type="text"
                placeholder="Search companies…"
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '5px 8px 5px 26px',
                  fontSize: 11,
                  border: `1px solid ${isDark ? '#1e3a55' : '#e2e8f0'}`,
                  borderRadius: 6,
                  background: isDark ? '#0a1520' : '#f8fafc',
                  color: isDark ? '#e2e8f0' : '#1e293b',
                  outline: 'none',
                }}
              />
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {allCompanies.filter(c => c.toLowerCase().includes(companySearch.toLowerCase())).length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: 11, color: isDark ? '#4a6580' : '#94a3b8' }}>No results</div>
            ) : allCompanies.filter(c => c.toLowerCase().includes(companySearch.toLowerCase())).map((c) => {
              const checked = selectedCompanies.has(c)
              return (
                <button
                  key={c}
                  onClick={() => setSelectedCompanies((prev) => { const next = new Set(prev); checked ? next.delete(c) : next.add(c); return next })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontSize: 11,
                    color: isDark ? (checked ? '#60a5fa' : '#7a93a8') : (checked ? '#2563eb' : '#64748b'),
                  }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: 3,
                    border: `1.5px solid ${checked ? (isDark ? '#3b82f6' : '#2563eb') : (isDark ? '#2a4060' : '#cbd5e1')}`,
                    background: checked ? (isDark ? '#3b82f6' : '#2563eb') : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    transition: 'all 0.15s',
                  }}>
                    {checked && (
                      <svg viewBox="0 0 10 10" style={{ width: 8, height: 8 }}>
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>
                  <span style={{ fontWeight: checked ? 500 : 400 }} title={c}>
                    {c.length > 22 ? c.slice(0, 21) + '…' : c}
                  </span>
                </button>
              )
            })}
          </div>
        </div>,
        document.body,
      )}

      {/* Severity dropdown portal */}
      {sevMenuOpen && sevMenuRect && createPortal(
        <div
          ref={sevDropRef}
          style={{
            position: 'fixed',
            top: sevMenuRect.bottom + 6,
            right: window.innerWidth - sevMenuRect.right,
            zIndex: 99999,
            width: 200,
            background: isDark ? '#0c1219' : '#ffffff',
            borderRadius: 12,
            border: `1px solid ${isDark ? 'rgba(30,50,72,0.6)' : 'rgba(180,200,235,0.5)'}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${isDark ? '#152030' : '#e2e8f0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>Filter by Severity</span>
            <button
              onClick={() => setSelectedSeverities(new Set())}
              style={{ fontSize: 10, color: isDark ? '#3b82f6' : '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Clear
            </button>
          </div>
          <div style={{ padding: '4px 0' }}>
            {SEV_OPTIONS.map(({ key, label, range }) => {
              const checked = selectedSeverities.has(key)
              const color = key === 'critical' ? '#ef4444' : key === 'medium' ? '#f59e0b' : '#3b82f6'
              return (
                <button
                  key={key}
                  onClick={() => setSelectedSeverities((prev) => { const next = new Set(prev); checked ? next.delete(key) : next.add(key); return next })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: 3,
                    border: `1.5px solid ${checked ? color : (isDark ? '#2a4060' : '#cbd5e1')}`,
                    background: checked ? color : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    transition: 'all 0.15s',
                  }}>
                    {checked && (
                      <svg viewBox="0 0 10 10" style={{ width: 8, height: 8 }}>
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: checked ? 600 : 400, color: checked ? color : (isDark ? '#7a93a8' : '#64748b') }}>
                      {label}
                    </span>
                  </span>
                  <span style={{ fontSize: 10, color: isDark ? '#4a6580' : '#94a3b8', fontFamily: 'monospace' }}>{range}</span>
                </button>
              )
            })}
          </div>
        </div>,
        document.body,
      )}

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">Threat Findings</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {serverTotal} {filter === 'all' ? 'total' : filterLabel.toLowerCase()}
              {(selectedCompanies.size > 0 || selectedSeverities.size > 0) && (
                <span className="ml-2 text-[var(--primary)]">
                  · {sorted.length} on this page
                  <button
                    onClick={() => { setSelectedCompanies(new Set()); setSelectedSeverities(new Set()) }}
                    className="ml-1.5 underline hover:no-underline"
                  >
                    clear
                  </button>
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Company filter */}
            <button
              ref={companyBtnRef}
              onClick={() => {
                const rect = companyBtnRef.current?.getBoundingClientRect()
                setCompanyMenuRect(rect ?? null)
                setCompanyMenuOpen((v) => { if (v) setCompanySearch(''); return !v })
                setSevMenuOpen(false)
              }}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors ${
                selectedCompanies.size > 0
                  ? 'border-[var(--primary)]/50 bg-[var(--primary)]/8 text-[var(--primary)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M8 1a2 2 0 0 1 2 2v.5h2.5A1.5 1.5 0 0 1 14 5v7.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5V5a1.5 1.5 0 0 1 1.5-1.5H6V3a2 2 0 0 1 2-2Zm0 1a1 1 0 0 0-1 1v.5h2V3a1 1 0 0 0-1-1Z"/>
              </svg>
              Company {selectedCompanies.size > 0 && `(${selectedCompanies.size})`}
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-50">
                <path d="M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"/>
              </svg>
            </button>

            {/* Severity filter */}
            <button
              ref={sevBtnRef}
              onClick={() => {
                const rect = sevBtnRef.current?.getBoundingClientRect()
                setSevMenuRect(rect ?? null)
                setSevMenuOpen((v) => !v)
                setCompanyMenuOpen(false)
              }}
              className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors ${
                selectedSeverities.size > 0
                  ? 'border-[var(--primary)]/50 bg-[var(--primary)]/8 text-[var(--primary)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14Zm0-1A6 6 0 1 0 8 2a6 6 0 0 0 0 12Zm-.5-4.75a.5.5 0 0 1 1 0v2.5a.5.5 0 0 1-1 0v-2.5Zm.5-2.25a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"/>
              </svg>
              Severity {selectedSeverities.size > 0 && `(${selectedSeverities.size})`}
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-50">
                <path d="M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"/>
              </svg>
            </button>

            <FindingsReportDownloadButton data={reportData} />
          </div>
        </div>

        <div className="flex gap-1 p-1 rounded-lg bg-[var(--surface)] w-fit">
          <button className={tabClass(filter === 'all')} onClick={() => setFilter('all')}>
            All {filter === 'all' && serverTotal > 0 && `(${serverTotal})`}
          </button>
          <button className={tabClass(filter === 'pending')} onClick={() => setFilter('pending')}>
            Pending {filter === 'pending' && serverTotal > 0 && `(${serverTotal})`}
          </button>
          <button className={tabClass(filter === 'reviewed')} onClick={() => setFilter('reviewed')}>
            Reviewed {filter === 'reviewed' && serverTotal > 0 && `(${serverTotal})`}
          </button>
          <button className={tabClass(filter === 'false_positive')} onClick={() => setFilter('false_positive')}>
            False Positives {filter === 'false_positive' && serverTotal > 0 && `(${serverTotal})`}
          </button>
        </div>

        <Card>
          {!isLoading && sorted.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-[var(--text-muted)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-10 h-10 mb-3 opacity-30">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <p className="text-sm font-medium">No findings found</p>
              <p className="text-xs mt-1 opacity-60">
                {filter === 'all' ? 'No threat findings detected yet.' : 'No findings match this filter.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <SortTh label="Title"          col="title"          sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Company"        col="company"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Classification" col="classification" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Status"         col="status"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label="Risk"           col="risk_score"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="w-32" />
                    <SortTh label="Detected"       col="created_at"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <SkeletonTableRows rows={6} widths={['w-2/5', 'w-24', 'w-20', 'w-20', 'w-28', 'w-20', 'w-4']} />
                  ) : pagedFindings.map((f) => (
                    <tr
                      key={f.id}
                      onClick={() => setSelectedId(f.id)}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3 font-medium text-[var(--text)] max-w-xs truncate">{f.title}</td>
                      <td className="px-5 py-3 text-sm text-[var(--text-muted)]">{f.company}</td>
                      <td className="px-5 py-3">
                        <Badge variant={classificationVariant[f.classification] ?? 'default'}>
                          {f.classification}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        {f.is_false_positive ? (
                          <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] inline-block" />
                            False Positive
                          </span>
                        ) : f.is_reviewed ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--success)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] inline-block" />
                            Reviewed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-[var(--warning)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] inline-block" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <RiskBar score={f.risk_score} />
                      </td>
                      <td className="px-5 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
                        {new Date(f.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[var(--text-muted)]">
                          <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                        </svg>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
              <span className="text-xs text-[var(--text-muted)]">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, serverTotal)} / {serverTotal} findings
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-7 w-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                  </svg>
                </button>
                <span className="text-xs text-[var(--text-muted)] tabular-nums px-2">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-7 w-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
