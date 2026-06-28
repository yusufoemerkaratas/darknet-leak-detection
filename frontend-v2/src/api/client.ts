import type {
  Source,
  SourceCreate,
  SourceHealth,
  SourceMetrics,
  Company,
  CompanyCreate,
  CrawlJob,
  Finding,
  FindingDetail,
  Alert,
  Paginated,
  Stats,
  DashboardOverview,
  FindingsByDay,
  AlertsBySeverity,
  FindingsBySeverity,
  SeverityCounts,
} from '../types'

const BASE_URL = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

const get = <T>(path: string) => request<T>(path)
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
const put = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined })
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' })

// ─── Health ──────────────────────────────────────────────────────────────────
export const healthApi = {
  check: () => get<{ status: string }>('/health'),
}

// ─── Stats ───────────────────────────────────────────────────────────────────
export const statsApi = {
  /** Legacy: GET /stats — always available */
  get: () => get<Stats>('/stats'),
  overview: () => get<Stats>('/stats/overview'),
  findingsByDay: (days = 30) => get<FindingsByDay[]>(`/stats/findings-by-day?days=${days}`),
  alertsBySeverity: () => get<AlertsBySeverity[]>('/stats/alerts-by-severity'),
  findingsBySeverity: () => get<SeverityCounts>('/stats/findings-by-severity'),
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const dashboardApi = {
  overview: () => get<DashboardOverview>('/dashboard/overview'),
  getFinding: (id: number) => get<Finding>(`/dashboard/findings/${id}`),
  updateFindingStatus: (id: number, status: string) =>
    patch<Finding>(`/dashboard/findings/${id}/status`, { status }),
  runLlmAnalysis: (id: number) =>
    post<Finding>(`/dashboard/findings/${id}/llm-analysis`),
}

// ─── Sources ─────────────────────────────────────────────────────────────────
export const sourcesApi = {
  list: () => get<Source[]>('/sources/'),
  create: (data: SourceCreate) => post<Source>('/sources/', data),
  update: (id: number, data: SourceCreate) => put<Source>(`/sources/${id}`, data),
  patch: (id: number, data: Partial<SourceCreate>) => patch<Source>(`/sources/${id}`, data),
  toggle: (id: number) => patch<Source>(`/sources/${id}/toggle`),
  delete: (id: number) => del(`/sources/${id}`),
  startCrawl: (id: number) => post(`/sources/${id}/crawl`),
  testCrawl: (id: number) => post(`/sources/${id}/test-crawl`),
  health: (id: number) => get<SourceHealth>(`/sources/${id}/health`),
  metrics: (id: number) => get<SourceMetrics>(`/sources/${id}/metrics`),
}

// ─── Companies ───────────────────────────────────────────────────────────────
export const companiesApi = {
  list: () => get<Company[]>('/companies/'),
  create: (data: CompanyCreate) => post<Company>('/companies/', data),
  update: (id: number, data: CompanyCreate) => put<Company>(`/companies/${id}`, data),
  delete: (id: number) => del(`/companies/${id}`),
}

// ─── Crawl Jobs ──────────────────────────────────────────────────────────────
export const crawlJobsApi = {
  list: (params?: { status?: string; source_id?: number; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.source_id) qs.set('source_id', String(params.source_id))
    qs.set('limit', String(params?.limit ?? 100))
    return get<CrawlJob[]>(`/crawl-jobs/?${qs}`)
  },
  get: (id: number) => get<CrawlJob>(`/crawl-jobs/${id}`),
}

// ─── Findings ────────────────────────────────────────────────────────────────
export const findingsApi = {
  list: (
    page = 1,
    size = 50,
    opts?: { is_reviewed?: boolean; is_false_positive?: boolean },
  ) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) })
    if (opts?.is_reviewed !== undefined) params.set('is_reviewed', String(opts.is_reviewed))
    if (opts?.is_false_positive !== undefined) params.set('is_false_positive', String(opts.is_false_positive))
    return get<Paginated<Finding>>(`/findings?${params}`)
  },
  get: (id: number) => get<FindingDetail>(`/findings/${id}`),
  markReviewed: (id: number, notes?: string) =>
    patch<FindingDetail>(`/findings/${id}/review`, { review_notes: notes }),
  markFalsePositive: (id: number) =>
    patch<FindingDetail>(`/findings/${id}/false-positive`),
  resetStatus: (id: number) =>
    patch<FindingDetail>(`/findings/${id}/reset`),
  runLlmAnalysis: (id: number) =>
    post<FindingDetail>(`/dashboard/findings/${id}/llm-analysis`),
  alerts: () =>
    get<Paginated<Alert>>('/findings/alerts').then((r) => r.items),
}

// ─── Alerts ──────────────────────────────────────────────────────────────────
export const alertsApi = {
  list: (opts?: { severity?: string; is_reviewed?: boolean; page?: number; size?: number }) => {
    const params = new URLSearchParams({ page: String(opts?.page ?? 1), size: String(opts?.size ?? 100) })
    if (opts?.severity) params.set('severity', opts.severity)
    if (opts?.is_reviewed !== undefined) params.set('is_reviewed', String(opts.is_reviewed))
    return get<Paginated<Alert>>(`/findings/alerts?${params}`)
  },
  markReviewed: (id: number, notes?: string) =>
    patch<Alert>(`/findings/alerts/${id}/review`, { review_notes: notes ?? null }),
  resetAlert: (id: number) =>
    patch<Alert>(`/findings/alerts/${id}/reset`, {}),
}
