import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { crawlJobsApi, sourcesApi } from '../api/client'
import type { CrawlJob, Source } from '../types'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { SkeletonTableRows } from '../components/ui/Skeleton'

const statusVariant: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  running: 'warning',
  completed: 'success',
  failed: 'danger',
  pending: 'info',
}

function formatDuration(start: string, end: string | null) {
  if (!end) return 'Running...'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export function CrawlJobs() {
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')

  const { data: sources } = useQuery<Source[]>({
    queryKey: ['sources'],
    queryFn: () => sourcesApi.list(),
  })

  const { data: jobs, isLoading } = useQuery<CrawlJob[]>({
    queryKey: ['crawl-jobs', statusFilter, sourceFilter],
    queryFn: () => crawlJobsApi.list({
      status: statusFilter || undefined,
      source_id: sourceFilter ? Number(sourceFilter) : undefined,
    }),
    refetchInterval: 10_000,
  })

  const sourceMap = Object.fromEntries((sources ?? []).map((s) => [s.id, s.name]))


  const selectClass = 'rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--primary)] transition-colors cursor-pointer'

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">Crawl Jobs</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Refreshes every 10 seconds</p>
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
            <option value="">All statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className={selectClass}>
            <option value="">All sources</option>
            {(sources ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        {!isLoading && (!jobs || jobs.length === 0) ? (
          <div className="flex flex-col items-center py-16 text-[var(--text-muted)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-10 h-10 mb-3 opacity-30">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
            </svg>
            <p className="text-sm">No crawl jobs found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Job ID</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Source</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Total</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Inserted</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Duplicates</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Started</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Duration</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <SkeletonTableRows rows={6} widths={['w-10', 'w-1/4', 'w-16', 'w-10', 'w-10', 'w-10', 'w-28', 'w-14']} />
                ) : (jobs ?? []).map((job) => (
                  <tr key={job.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-[var(--text-muted)]">#{job.id}</td>
                    <td className="px-5 py-4 font-medium text-[var(--text)]">
                      {sourceMap[job.source_id] ?? `Source #${job.source_id}`}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={statusVariant[job.status] ?? 'default'}>
                        {job.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-[var(--text)]">{job.total_records}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-green-500">{job.inserted_records}</td>
                    <td className="px-5 py-4 text-right tabular-nums text-[var(--text-muted)]">{job.duplicate_records}</td>
                    <td className="px-5 py-4 text-[var(--text-muted)] text-xs whitespace-nowrap">
                      {new Date(job.started_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-[var(--text-muted)] text-xs">
                      {formatDuration(job.started_at, job.finished_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
