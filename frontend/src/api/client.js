const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  return response.json();
}

export const get = (endpoint) => apiRequest(endpoint);

export const post = (endpoint, data) =>
  apiRequest(endpoint, {
    method: "POST",
    body: data === undefined ? undefined : JSON.stringify(data),
  });

export const patch = (endpoint, data) =>
  apiRequest(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

function mapFinding(finding) {
  return {
    id: finding.id,
    company: finding.company,
    type: finding.type,
    severity: finding.severity,
    riskScore: finding.risk_score,
    status: finding.status,
    detectedAt: finding.detected_at,
    source: finding.source,
    affected: finding.affected,
  }
}

function mapFindingDetail(finding) {
  return {
    ...mapFinding(finding),
    title: finding.title,
    summary: finding.summary,
    recommendedAction: finding.recommended_action,
    rawUrl: finding.raw_url,
    publishedAt: finding.published_at,
    evidence: finding.evidence ?? [],
  }
}

export async function getDashboardOverview(timelineRange = '7d') {
  const query = new URLSearchParams({ timeline_range: timelineRange }).toString()
  const data = await get(`/dashboard/overview?${query}`)

  return {
    ...data,
    findings: (data.findings ?? []).map(mapFinding),
    critical_alerts: (data.critical_alerts ?? []).map(mapFinding),
  }
}

export async function getFindingDetail(findingId) {
  const data = await get(`/dashboard/findings/${findingId}`)
  return mapFindingDetail(data)
}

export async function updateFindingStatus(findingId, status) {
  const data = await patch(`/dashboard/findings/${findingId}/status`, { status })
  return mapFindingDetail(data)
}

export async function getSources(filters = {}) {
  const query = new URLSearchParams()

  if (filters.name) query.set('name', filters.name)
  if (typeof filters.isActive === 'boolean') query.set('is_active', String(filters.isActive))

  const suffix = query.toString() ? `?${query.toString()}` : ''
  return get(`/sources${suffix}`)
}

export const createSource = (source) => post('/sources', source)

export const updateSource = (sourceId, source) => patch(`/sources/${sourceId}`, source)

export const toggleSource = (sourceId) => patch(`/sources/${sourceId}/toggle`, {})

export const getSourceHealth = (sourceId) => get(`/sources/${sourceId}/health`)

export const getSourceMetrics = (sourceId) => get(`/sources/${sourceId}/metrics`)

export const testSourceCrawl = (sourceId) => post(`/sources/${sourceId}/test-crawl`)
