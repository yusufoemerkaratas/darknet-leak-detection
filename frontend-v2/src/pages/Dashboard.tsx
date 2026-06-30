import { useQuery } from '@tanstack/react-query'
import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, ReferenceArea, ReferenceLine,
} from 'recharts'
import { statsApi, dashboardApi, findingsApi } from '../api/client'
import type { Stats, SeverityCounts } from '../types'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { PageLoader } from '../components/ui/Spinner'
import { useTheme } from '../context/ThemeContext'
import { ReportDownloadButton } from '../components/ReportPDF'
import type { ReportData } from '../components/ReportPDF'
import { severityFromScore, severityLabel } from '../utils/severity'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FindingsByDay { date: string; findings?: number; count?: number }

function fmtDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (days <= 7)  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
  if (days <= 31) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function tickInterval(days: number): number {
  if (days <= 7)  return 0
  if (days <= 31) return 4
  return Math.floor(days / 10)
}
interface DashboardOverviewData {
  generated_at: string
  summary: {
    total_findings: number
    critical_alerts: number
    reviewed_findings: number
    monitored_companies: number
    latest_collection: string
  }
  findings: {
    id: number; company: string; type: string; severity: string
    risk_score: number; status: string; detected_at: string; source: string
  }[]
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: { v: number }[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={52}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#sg-${color.replace('#', '')})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color: string
  sparkData?: { v: number }[]
  icon: React.ReactNode
  onClick?: () => void
  footer?: React.ReactNode
}

function StatCard({ label, value, sub, color, sparkData, icon, onClick, footer }: StatCardProps) {
  return (
    <Card
      className={`relative overflow-hidden ${onClick ? 'cursor-pointer hover:ring-1 hover:ring-[var(--primary)]/30 transition-all' : ''}`}
      onClick={onClick}
    >
      <div className="p-5 pb-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${color}18`, color }}
          >
            {icon}
          </div>
        </div>
        <p className="text-3xl font-black text-[var(--text)] tabular-nums leading-none">{value}</p>
        {sub && <p className="text-xs text-[var(--text-muted)] mt-1.5">{sub}</p>}
        {footer && <div onClick={(e) => e.stopPropagation()}>{footer}</div>}
      </div>
      {sparkData && sparkData.length > 1 && (
        <div className="px-0 pb-0">
          <Sparkline data={sparkData} color={color} />
        </div>
      )}
    </Card>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs shadow-xl">
      {label && <p className="font-medium text-[var(--text)] mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-[var(--primary)]">{p.value} findings</p>
      ))}
    </div>
  )
}

const SEVERITY_COLORS = { critical: '#ef4444', medium: '#f59e0b', low: '#3b82f6' }

// ─── Chart Detail Modal ───────────────────────────────────────────────────────

function ChartModal({ onClose, children, title, subtitle }: {
  onClose: () => void
  children: React.ReactNode
  title: string
  subtitle?: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl bg-[var(--glass)] backdrop-blur-xl border border-[var(--glass-border)] shadow-2xl shadow-black/30">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>
            {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function TimelineDetail({ data, axisColor, gridColor }: {
  data: { date: string; v: number }[]
  axisColor: string
  gridColor: string
}) {
  const total   = data.reduce((s, d) => s + d.v, 0)
  const peak    = data.reduce((m, d) => d.v > m.v ? d : m, { date: '', v: 0 })
  const avg     = data.length ? (total / data.length).toFixed(1) : '0'
  const topDays = [...data].sort((a, b) => b.v - a.v).slice(0, 8)

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total findings', value: total },
          { label: 'Peak day', value: peak.v, sub: peak.date },
          { label: 'Daily avg', value: avg },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-4 py-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">{s.label}</p>
            <p className="text-2xl font-black text-[var(--text)] tabular-nums">{s.value}</p>
            {s.sub && <p className="text-xs text-[var(--text-muted)] mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Large chart */}
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
          <defs>
            <linearGradient id="areaGradDetail" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} strokeOpacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: axisColor }}
            axisLine={false}
            tickLine={false}
            interval={Math.floor(data.length / 8)}
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 10, fill: axisColor }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v: number) => {
              if (v === 0) return '0'
              if (v % 1000 !== 0) return ''
              return `${v / 1000}k`
            }}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="v"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#areaGradDetail)"
            dot={data.length <= 10 ? { fill: '#3b82f6', r: 3, strokeWidth: 0 } : false}
            activeDot={{ r: 5, fill: '#60a5fa' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Top days table */}
      {topDays.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Top Days</p>
          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            {topDays.map((d, i) => (
              <div key={d.date} className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                <span className="text-xs font-bold text-[var(--text-muted)] w-4 tabular-nums">{i + 1}</span>
                <span className="text-xs text-[var(--text)] flex-1">{d.date}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${(d.v / peak.v) * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-[var(--text)] w-6 text-right">{d.v}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SeverityDetail({ sevData, total }: {
  sevData: { name: string; value: number; color: string }[]
  total: number
}) {
  return (
    <div className="space-y-6">
      {/* Large donut */}
      <div className="flex flex-col sm:flex-row items-center gap-8">
        <div className="shrink-0">
          <ResponsiveContainer width={240} height={240}>
            <PieChart>
              <Pie data={sevData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius={70} outerRadius={108} paddingAngle={3} strokeWidth={0}>
                {sevData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs shadow-xl">
                    <p className="font-medium text-[var(--text)]">{payload[0].name}: {payload[0].value}</p>
                  </div>
                ) : null}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-3 w-full">
          {sevData.map((s) => {
            const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
            return (
              <div key={s.name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-sm font-medium text-[var(--text)]">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-muted)]">{pct}%</span>
                    <span className="text-sm font-bold tabular-nums text-[var(--text)] w-8 text-right">{s.value}</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface)] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: s.color }} />
                </div>
              </div>
            )
          })}

          <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">Total findings</span>
            <span className="text-sm font-black tabular-nums text-[var(--text)]">{total}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReviewedDetail({ allFindings }: { allFindings: { is_reviewed?: unknown; is_false_positive?: unknown }[] }) {
  const total    = allFindings.length
  const fp       = allFindings.filter((f) => f.is_false_positive).length
  const reviewed = allFindings.filter((f) => f.is_reviewed && !f.is_false_positive).length
  const pending  = total - reviewed - fp

  const items = [
    { label: 'Reviewed',       value: reviewed, color: '#10b981' },
    { label: 'Pending',        value: pending,  color: '#f59e0b' },
    { label: 'False Positive', value: fp,       color: '#6b7280' },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <div key={it.label} className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-4 py-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">{it.label}</p>
            <p className="text-2xl font-black tabular-nums" style={{ color: it.color }}>{it.value}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{total > 0 ? Math.round((it.value / total) * 100) : 0}%</p>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {items.map((it) => {
          const pct = total > 0 ? Math.round((it.value / total) * 100) : 0
          return (
            <div key={it.label}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: it.color }} />
                  <span className="text-sm font-medium text-[var(--text)]">{it.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)]">{pct}%</span>
                  <span className="text-sm font-bold tabular-nums text-[var(--text)] w-8 text-right">{it.value}</span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-[var(--surface)] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: it.color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CompaniesDetail({ allFindings }: { allFindings: { company: string; risk_score: number }[] }) {
  const companyMap = allFindings.reduce((acc, f) => {
    const name = f.company || 'Unknown'
    if (!acc[name]) acc[name] = { total: 0, critical: 0, medium: 0 }
    acc[name].total++
    if (f.risk_score >= 90) acc[name].critical++
    else if (f.risk_score >= 75) acc[name].medium++
    return acc
  }, {} as Record<string, { total: number; critical: number; medium: number }>)

  const companies = Object.entries(companyMap).sort((a, b) => b[1].total - a[1].total)
  const maxTotal  = companies[0]?.[1].total ?? 1

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total companies', value: companies.length },
          { label: 'With critical',   value: companies.filter(([, v]) => v.critical > 0).length },
          { label: 'Total findings',  value: allFindings.length },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-[var(--surface)] border border-[var(--border)] px-4 py-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">{s.label}</p>
            <p className="text-2xl font-black text-[var(--text)] tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border)] grid grid-cols-[1fr_auto_auto_auto] gap-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
          <span>Company</span>
          <span className="text-center w-14">Critical</span>
          <span className="text-center w-14">Medium</span>
          <span className="text-right w-12">Total</span>
        </div>
        <div className="divide-y divide-[var(--border)] max-h-72 overflow-y-auto">
          {companies.map(([name, stat]) => (
            <div key={name} className="px-4 py-2.5 hover:bg-[var(--surface)] transition-colors">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center mb-1.5">
                <span className="text-sm font-medium text-[var(--text)] truncate">{name}</span>
                <span className="text-xs tabular-nums font-semibold text-red-400 text-center w-14">{stat.critical || '—'}</span>
                <span className="text-xs tabular-nums text-amber-400 text-center w-14">{stat.medium || '—'}</span>
                <span className="text-xs tabular-nums font-bold text-[var(--text)] text-right w-12">{stat.total}</span>
              </div>
              <div className="h-1 rounded-full bg-[var(--surface)] overflow-hidden">
                <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${(stat.total / maxTotal) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  const axisColor = dark ? '#7a93a8' : '#64748b'
  const gridColor = dark ? '#1e3354' : '#e2e8f0'
  const isDark = dark

  // ── Chart modal state ──
  type ActiveChart = null | 'timeline' | 'severity' | 'total' | 'critical' | 'reviewed' | 'companies'
  const [activeChart, setActiveChart] = useState<ActiveChart>(null)

  // ── Chart period — must be declared before queries that reference it ──
  const [chartDays, setChartDays] = useState(30)

  // ── Total Findings period tab ──
  const [periodTab, setPeriodTab] = useState<'all' | 'day' | 'month' | 'year'>('all')

  // ── Queries ──
  const statsQ      = useQuery<Stats>({ queryKey: ['stats'], queryFn: () => statsApi.get(), refetchInterval: 30_000, retry: 1 })
  const byDayQ      = useQuery<FindingsByDay[]>({ queryKey: ['findings-by-day', chartDays], queryFn: () => statsApi.findingsByDay(chartDays), retry: 1 })
  const byDay1Q     = useQuery<FindingsByDay[]>({ queryKey: ['findings-by-day', 1],   queryFn: () => statsApi.findingsByDay(1),   retry: 1 })
  const byDay30Q    = useQuery<FindingsByDay[]>({ queryKey: ['findings-by-day', 30],  queryFn: () => statsApi.findingsByDay(30),  retry: 1 })
  const byDay365Q   = useQuery<FindingsByDay[]>({ queryKey: ['findings-by-day', 365], queryFn: () => statsApi.findingsByDay(365), retry: 1 })
  const sevCountsQ  = useQuery<SeverityCounts>({ queryKey: ['severity-counts'], queryFn: () => statsApi.findingsBySeverity(), retry: 1 })
  const overviewQ   = useQuery<DashboardOverviewData>({ queryKey: ['dashboard-overview'], queryFn: () => dashboardApi.overview() as unknown as Promise<DashboardOverviewData>, retry: 1 })
  // Authoritative findings list — same source as Threat Findings page
  const findingsQ   = useQuery({ queryKey: ['findings'], queryFn: () => findingsApi.list(1, 100), retry: 1 })

  // ── Company filter state ──
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterRect, setFilterRect] = useState<DOMRect | null>(null)
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const filterDropRef = useRef<HTMLDivElement>(null)

  // ── Severity filter state ──
  type SevKey = 'critical' | 'medium' | 'low'
  const [selectedSeverities, setSelectedSeverities] = useState<Set<SevKey>>(new Set())
  const [sevFilterOpen, setSevFilterOpen] = useState(false)
  const [sevFilterRect, setSevFilterRect] = useState<DOMRect | null>(null)
  const sevFilterBtnRef = useRef<HTMLButtonElement>(null)
  const sevFilterDropRef = useRef<HTMLDivElement>(null)

  // For display (recent findings list) — from overview
  const overviewFindings = overviewQ.data?.findings ?? []

  // For severity counting & company filter — authoritative source matching Threat Findings page
  type RawFinding = { id: number; company: string; risk_score: number; [key: string]: unknown }
  const allFindings: RawFinding[] = (findingsQ.data?.items ?? []) as unknown as RawFinding[]

  const companies = useMemo(() => {
    const names = new Set<string>()
    // Use overview findings for company names (they have the source field)
    overviewFindings.forEach((f) => names.add(f.company !== 'Unknown' ? f.company : f.source))
    return Array.from(names).sort()
  }, [overviewFindings])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node
      if (filterDropRef.current && !filterDropRef.current.contains(t) &&
          filterBtnRef.current && !filterBtnRef.current.contains(t)) {
        setFilterOpen(false)
      }
    }
    if (filterOpen) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [filterOpen])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node
      if (sevFilterDropRef.current && !sevFilterDropRef.current.contains(t) &&
          sevFilterBtnRef.current && !sevFilterBtnRef.current.contains(t)) {
        setSevFilterOpen(false)
      }
    }
    if (sevFilterOpen) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [sevFilterOpen])

  // ── Derived data (before early return — cannot use hooks after conditional) ──
  const dailyData = useMemo(() => (byDayQ.data ?? []).map((d) => ({
    date: fmtDate(d.date, chartDays),
    rawDate: d.date,
    v: d.findings ?? (d as any).count ?? 0,
  })), [byDayQ.data, chartDays])

  const sparkData = useMemo(() => dailyData.map((d) => ({ v: d.v })), [dailyData])

  const yAxisTicks = useMemo(() => {
    const maxV = Math.max(...dailyData.map((d) => d.v), 0)
    const step  = 1000
    const top   = Math.ceil(maxV / step) * step || step
    return Array.from({ length: top / step + 1 }, (_, i) => i * step)
  }, [dailyData])

  // Period groups for reference areas (month bands for 30d, year bands for 365d)
  const periodGroups = useMemo(() => {
    if (chartDays !== 30 && chartDays !== 365) return []
    if (dailyData.length === 0) return []

    const getKey  = (raw: string) => {
      const d = new Date(raw + 'T00:00:00')
      return chartDays === 365 ? d.getFullYear().toString() : `${d.getFullYear()}-${d.getMonth()}`
    }
    const getLabel = (raw: string) => {
      const d = new Date(raw + 'T00:00:00')
      return chartDays === 365
        ? d.getFullYear().toString()
        : d.toLocaleDateString(undefined, { month: 'short' })
    }

    const groups: { x1: string; x2: string; label: string; idx: number }[] = []
    let curKey = ''
    let startX = ''
    let idx = 0

    dailyData.forEach((d, i) => {
      const k = getKey(d.rawDate)
      if (k !== curKey) {
        if (curKey && startX) {
          groups.push({ x1: startX, x2: dailyData[i - 1].date, label: getLabel(dailyData[i - 1].rawDate), idx })
          idx++
        }
        curKey = k
        startX = d.date
      }
      if (i === dailyData.length - 1 && startX) {
        groups.push({ x1: startX, x2: d.date, label: getLabel(d.rawDate), idx })
      }
    })

    return groups
  }, [dailyData, chartDays])

  // ── Early return after all hooks ──
  if (statsQ.isLoading) return <PageLoader />

  const stats    = statsQ.data
  const overview = overviewQ.data
  const summary  = overview?.summary

  // Severity counts from backend (includes all findings, not just first 100)
  const globalSevCounts: SeverityCounts = sevCountsQ.data ?? {
    critical: allFindings.filter((f) => f.risk_score >= 90).length,
    medium:   allFindings.filter((f) => f.risk_score >= 75 && f.risk_score < 90).length,
    low:      allFindings.filter((f) => f.risk_score < 75).length,
  }

  const todayCount = (byDay1Q.data ?? []).reduce((s, d) => s + (d.findings ?? d.count ?? 0), 0)
  const monthCount = (byDay30Q.data ?? []).reduce((s, d) => s + (d.findings ?? d.count ?? 0), 0)
  const yearCount  = (byDay365Q.data ?? []).reduce((s, d) => s + (d.findings ?? d.count ?? 0), 0)
  const allTotal   = stats?.total_records ?? summary?.total_findings ?? 0

  const totalDisplayValue =
    periodTab === 'day'   ? todayCount :
    periodTab === 'month' ? monthCount :
    periodTab === 'year'  ? yearCount  : allTotal

  const PERIOD_TABS = [
    { key: 'all',   label: 'All' },
    { key: 'day',   label: 'Day' },
    { key: 'month', label: 'Month' },
    { key: 'year',  label: 'Year' },
  ] as const

  function handlePeriodTab(key: typeof periodTab) {
    setPeriodTab(key)
    if (key === 'day')   setChartDays(7)
    if (key === 'month') setChartDays(30)
    if (key === 'year')  setChartDays(365)
    // 'all' keeps current chart range
  }

  const periodFooter = (
    <div className="flex gap-1 mt-2.5">
      {PERIOD_TABS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => handlePeriodTab(key)}
          className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors ${
            periodTab === key
              ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40'
              : 'text-[var(--text-muted)] hover:text-[var(--text)] bg-[var(--surface)]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )

  const sevData = [
    { name: 'Critical', value: globalSevCounts.critical, color: SEVERITY_COLORS.critical },
    { name: 'Medium',   value: globalSevCounts.medium,   color: SEVERITY_COLORS.medium },
    { name: 'Low',      value: globalSevCounts.low,      color: SEVERITY_COLORS.low },
  ].filter((d) => d.value > 0)

  const recentFindings = overviewFindings.slice(0, 6)

  // PDF uses overview findings (richer fields: source, detected_at, status)
  const filteredForPdf = overviewFindings
    .filter((f) => selectedCompanies.size === 0 || selectedCompanies.has(f.company !== 'Unknown' ? f.company : f.source))
    .filter((f) => selectedSeverities.size === 0 || selectedSeverities.has(severityFromScore(f.risk_score) as SevKey))

  // Always use authoritative global counts for severity so PDF matches UI stat cards.
  // filteredForPdf is only the most recent 100 findings, so counting severity from it
  // would produce wrong numbers that don't match the global totals shown on screen.
  const pdfSummary = {
    total_findings:      stats?.total_records ?? summary?.total_findings ?? 0,
    critical_alerts:     globalSevCounts.critical,
    reviewed_findings:   summary?.reviewed_findings ?? stats?.analyzed ?? 0,
    monitored_companies: summary?.monitored_companies ?? 0,
    latest_collection:   overview?.summary.latest_collection,
  }

  // Only build reportData once the severity counts are confirmed loaded to avoid
  // generating the PDF with fallback (100-item) counts instead of global counts.
  const reportData: ReportData | null = (overview && sevCountsQ.data) ? {
    generatedAt: overview.generated_at,
    summary: pdfSummary,
    severity: globalSevCounts,
    findings: filteredForPdf,
    filters: {
      companies:  Array.from(selectedCompanies),
      severities: Array.from(selectedSeverities),
    },
  } : null

  const severityBadge = (riskScore: number): 'danger' | 'warning' | 'info' => {
    const s = severityFromScore(riskScore)
    if (s === 'critical') return 'danger'
    if (s === 'medium')   return 'warning'
    return 'info'
  }

  function toggleCompany(name: string) {
    setSelectedCompanies((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function openFilter() {
    if (filterBtnRef.current) setFilterRect(filterBtnRef.current.getBoundingClientRect())
    setFilterOpen((v) => !v)
  }

  function toggleSeverity(key: SevKey) {
    setSelectedSeverities((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function openSevFilter() {
    if (sevFilterBtnRef.current) setSevFilterRect(sevFilterBtnRef.current.getBoundingClientRect())
    setSevFilterOpen((v) => !v)
  }

  const SEV_OPTIONS: { key: SevKey; label: string; range: string; color: string }[] = [
    { key: 'critical', label: 'Critical', range: '≥ 90', color: '#ef4444' },
    { key: 'medium',   label: 'Medium',   range: '75–89', color: '#f59e0b' },
    { key: 'low',      label: 'Low',      range: '< 75', color: '#3b82f6' },
  ]

  const filterLabel = selectedCompanies.size === 0
    ? 'All companies'
    : `${selectedCompanies.size} compan${selectedCompanies.size === 1 ? 'y' : 'ies'}`

  const sevFilterLabel = selectedSeverities.size === 0
    ? 'All severities'
    : Array.from(selectedSeverities).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')

  const sevFilterDropdown = sevFilterOpen && sevFilterRect ? createPortal(
    <div
      ref={sevFilterDropRef}
      style={{
        position: 'fixed',
        top: sevFilterRect.bottom + 8,
        right: window.innerWidth - sevFilterRect.right,
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
        {SEV_OPTIONS.map(({ key, label, range, color }) => {
          const checked = selectedSeverities.has(key)
          return (
            <button
              key={key}
              onClick={() => toggleSeverity(key)}
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
                  <svg viewBox="0 0 10 10" fill="white" style={{ width: 8, height: 8 }}>
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
    document.body
  ) : null

  const filterDropdown = filterOpen && filterRect ? createPortal(
    <div
      ref={filterDropRef}
      style={{
        position: 'fixed',
        top: filterRect.bottom + 8,
        right: window.innerWidth - filterRect.right,
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
      {/* Header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: `1px solid ${isDark ? '#152030' : '#e2e8f0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>Filter by Company</span>
        <button
          onClick={() => setSelectedCompanies(new Set())}
          style={{ fontSize: 10, color: isDark ? '#3b82f6' : '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Clear all
        </button>
      </div>
      {/* Company list */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
        {companies.map((name) => {
          const checked = selectedCompanies.has(name)
          return (
            <button
              key={name}
              onClick={() => toggleCompany(name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '6px 12px', background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left', fontSize: 11,
                color: isDark ? (checked ? '#60a5fa' : '#7a93a8') : (checked ? '#2563eb' : '#64748b'),
              }}
            >
              {/* Checkbox */}
              <span style={{
                width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${checked ? (isDark ? '#3b82f6' : '#2563eb') : (isDark ? '#2a4060' : '#cbd5e1')}`,
                background: checked ? (isDark ? '#3b82f6' : '#2563eb') : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                transition: 'all 0.15s',
              }}>
                {checked && (
                  <svg viewBox="0 0 10 10" fill="white" style={{ width: 8, height: 8 }}>
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                )}
              </span>
              <span style={{ fontWeight: checked ? 500 : 400 }} title={name}>
                {name.length > 22 ? name.slice(0, 21) + '…' : name}
              </span>
            </button>
          )
        })}
      </div>
    </div>,
    document.body
  ) : null

  const expandIcon = (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M1.75 1h4.5a.75.75 0 0 1 0 1.5H2.5v3.75a.75.75 0 0 1-1.5 0v-4.5C1 1.336 1.336 1 1.75 1Zm12.5 0a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V2.5H9.75a.75.75 0 0 1 0-1.5h4.5ZM1 9.75a.75.75 0 0 1 1.5 0v3.75h3.75a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 1 14.25v-4.5Zm13.5 0v4.5a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1 0-1.5h3.75V9.75a.75.75 0 0 1 1.5 0Z" />
    </svg>
  )

  return (
    <>
    {(activeChart === 'timeline' || activeChart === 'total') && (
      <ChartModal title="Findings Over Time" subtitle="Daily threat findings detected" onClose={() => setActiveChart(null)}>
        <TimelineDetail data={dailyData} axisColor={axisColor} gridColor={gridColor} />
      </ChartModal>
    )}
    {(activeChart === 'severity' || activeChart === 'critical') && (
      <ChartModal title="Severity Distribution" subtitle="Findings breakdown by risk level" onClose={() => setActiveChart(null)}>
        <SeverityDetail sevData={sevData} total={allFindings.length} />
      </ChartModal>
    )}
    {activeChart === 'reviewed' && (
      <ChartModal title="Review Status" subtitle="Findings by review state" onClose={() => setActiveChart(null)}>
        <ReviewedDetail allFindings={allFindings as { is_reviewed?: unknown; is_false_positive?: unknown }[]} />
      </ChartModal>
    )}
    {activeChart === 'companies' && (
      <ChartModal title="Companies Monitored" subtitle="Findings distribution by company" onClose={() => setActiveChart(null)}>
        <CompaniesDetail allFindings={allFindings} />
      </ChartModal>
    )}
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-[var(--text)]">Security Overview</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {summary?.latest_collection ? `Last updated: ${summary.latest_collection}` : 'Live threat intelligence dashboard'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Severity filter */}
          <button
            ref={sevFilterBtnRef}
            onClick={openSevFilter}
            className={`flex items-center gap-2 h-8 px-3 rounded-lg border text-xs font-medium transition-colors ${
              selectedSeverities.size > 0
                ? 'border-[var(--primary)]/60 bg-[var(--primary)]/8 text-[var(--primary)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--primary)]/40'
            }`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M10 1a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1ZM5.05 3.05a.75.75 0 0 1 1.06 0l1.062 1.06A.75.75 0 1 1 6.11 5.173L5.05 4.11a.75.75 0 0 1 0-1.06ZM14.95 3.05a.75.75 0 0 1 0 1.06l-1.06 1.062a.75.75 0 0 1-1.062-1.061l1.061-1.061a.75.75 0 0 1 1.06 0ZM3 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 3 8Zm11 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 14 8Zm-6.828 2.828a.75.75 0 0 1 0 1.061L6.11 12.95a.75.75 0 0 1-1.06-1.06l1.06-1.062a.75.75 0 0 1 1.061 0Zm3.594-3.317a.75.75 0 0 1 1.06 0l1.062 1.06a.75.75 0 0 1-1.061 1.062l-1.06-1.061a.75.75 0 0 1 0-1.061ZM10 13a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 13ZM6 8a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" clipRule="evenodd" />
            </svg>
            {sevFilterLabel}
          </button>
          {/* Company filter */}
          <button
            ref={filterBtnRef}
            onClick={openFilter}
            className={`flex items-center gap-2 h-8 px-3 rounded-lg border text-xs font-medium transition-colors ${
              selectedCompanies.size > 0
                ? 'border-[var(--primary)]/60 bg-[var(--primary)]/8 text-[var(--primary)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--primary)]/40'
            }`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 0 1 .628.74v2.288a2.25 2.25 0 0 1-.659 1.59l-4.682 4.683a2.25 2.25 0 0 0-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 0 1 8 18.25v-5.757a2.25 2.25 0 0 0-.659-1.591L2.659 6.22A2.25 2.25 0 0 1 2 4.629V2.34a.75.75 0 0 1 .628-.74Z" clipRule="evenodd" />
            </svg>
            {filterLabel}
          </button>
          <ReportDownloadButton data={reportData} />
        </div>
      </div>

      {filterDropdown}
      {sevFilterDropdown}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Findings"
          value={totalDisplayValue.toLocaleString()}
          color="#3b82f6"
          sparkData={sparkData}
          onClick={() => setActiveChart('total')}
          icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" /></svg>}
          footer={periodFooter}
        />
        <StatCard
          label="Critical Findings"
          value={globalSevCounts.critical}
          sub={`${globalSevCounts.medium} medium · ${globalSevCounts.low} low`}
          color="#ef4444"
          sparkData={sparkData.map(d => ({ v: Math.round(d.v * 0.02) }))}
          onClick={() => setActiveChart('critical')}
          icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" /></svg>}
        />
        <StatCard
          label="Reviewed"
          value={(summary?.reviewed_findings ?? stats?.analyzed ?? 0).toLocaleString()}
          sub={`${Math.round(((summary?.reviewed_findings ?? stats?.analyzed ?? 0) / Math.max(summary?.total_findings ?? stats?.total_records ?? 1, 1)) * 100)}% of total`}
          color="#8b5cf6"
          sparkData={sparkData.map(d => ({ v: Math.round(d.v * 0.5) }))}
          onClick={() => setActiveChart('reviewed')}
          icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" /></svg>}
        />
        <StatCard
          label="Companies Monitored"
          value={summary?.monitored_companies ?? 0}
          sub="Active threat profiles"
          color="#10b981"
          sparkData={[{ v: 30 }, { v: 33 }, { v: 35 }, { v: 37 }]}
          onClick={() => setActiveChart('companies')}
          icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 16.5v-13h-.25a.75.75 0 0 1 0-1.5h12.5a.75.75 0 0 1 0 1.5H16v13h.25a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75v-2.5a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1 0-1.5H4Z" clipRule="evenodd" /></svg>}
        />
      </div>

      {/* ── Main area chart + severity donut ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Findings over time */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">Findings Over Time</h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Daily threat findings detected</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex rounded-lg overflow-hidden border border-[var(--border)]">
                {([7, 30, 365] as const).map((d, i) => (
                  <button
                    key={d}
                    onClick={() => setChartDays(d)}
                    className={`px-2 py-1 text-[10px] font-semibold transition-colors ${
                      chartDays === d
                        ? 'bg-[var(--primary)] text-white'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)] bg-[var(--surface)]'
                    } ${i > 0 ? 'border-l border-[var(--border)]' : ''}`}
                  >
                    {d === 7 ? 'W' : d === 30 ? 'M' : 'Y'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setActiveChart('timeline')}
                title="Expand chart"
                className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors p-1 rounded-lg hover:bg-[var(--surface)]"
              >
                {expandIcon}
              </button>
            </div>
          </CardHeader>
          <CardBody className="pr-4">
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyData} margin={{ top: 8, right: 4, left: -8, bottom: periodGroups.length > 0 ? 14 : 0 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} strokeOpacity={0.4} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    interval={tickInterval(chartDays)}
                    minTickGap={36}
                    hide={periodGroups.length > 0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                    ticks={yAxisTicks}
                    domain={[0, yAxisTicks[yAxisTicks.length - 1]]}
                    tickFormatter={(v: number) => v === 0 ? '0' : `${v / 1000}k`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  {/* Period bands (month or year) */}
                  {periodGroups.map((g) => (
                    <ReferenceArea
                      key={g.label + g.idx}
                      x1={g.x1}
                      x2={g.x2}
                      fill={g.idx % 2 === 0 ? (dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)') : 'transparent'}
                      stroke="none"
                      label={{
                        value: g.label,
                        position: 'insideBottomLeft',
                        offset: 4,
                        fontSize: 9,
                        fontWeight: 600,
                        fill: axisColor,
                        opacity: 0.7,
                      }}
                    />
                  ))}
                  {/* Vertical dividers at period boundaries */}
                  {periodGroups.slice(1).map((g) => (
                    <ReferenceLine
                      key={`div-${g.label}-${g.idx}`}
                      x={g.x1}
                      stroke={dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
                      strokeDasharray="3 3"
                    />
                  ))}
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#areaGrad)"
                    dot={chartDays <= 7 ? { fill: '#3b82f6', r: 3, strokeWidth: 0 } : false}
                    activeDot={{ r: 5, fill: '#60a5fa' }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-sm text-[var(--text-muted)] opacity-50">No time-series data yet</div>
            )}
          </CardBody>
        </Card>

        {/* Severity distribution */}
        <Card>
          <CardHeader className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">Severity Distribution</h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Findings by risk level</p>
            </div>
            <button
              onClick={() => setActiveChart('severity')}
              title="Expand chart"
              className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors p-1 rounded-lg hover:bg-[var(--surface)] shrink-0"
            >
              {expandIcon}
            </button>
          </CardHeader>
          <CardBody>
            {sevData.length > 0 ? (
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={sevData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {sevData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs shadow-xl">
                            <p className="font-medium text-[var(--text)]">{payload[0].name}: {payload[0].value}</p>
                          </div>
                        ) : null
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-2">
                  {sevData.map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                        <span className="text-[var(--text-muted)]">{s.name}</span>
                      </div>
                      <span className="font-semibold text-[var(--text)]">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-[var(--text-muted)] opacity-50">No data</div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Recent findings ── */}
      {recentFindings.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--text)]">Recent Findings</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Latest detected threats</p>
          </CardHeader>
          <div className="divide-y divide-[var(--border)]">
            {recentFindings.map((f) => {
              const scoreColor = f.risk_score >= 90 ? 'var(--danger)' : f.risk_score >= 75 ? 'var(--warning)' : 'var(--primary)'
              const dateStr = f.detected_at
                ? new Date(f.detected_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
                : '—'
              return (
                <div key={f.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface)] transition-colors">
                  <Badge variant={severityBadge(f.risk_score)}>{severityLabel(f.risk_score)}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text)] truncate">{f.type}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{f.company !== 'Unknown' ? f.company : (f.source ?? '—')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums" style={{ color: scoreColor }}>{f.risk_score}</p>
                    <p className="text-xs text-[var(--text-muted)]">{dateStr}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <p className="text-xs text-[var(--text-muted)] text-right opacity-50">
        {summary?.latest_collection ? `Last collection: ${summary.latest_collection}` : ''} · Auto-refreshes every 30s
      </p>
    </div>
    </>
  )
}
