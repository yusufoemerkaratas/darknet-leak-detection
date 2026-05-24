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
    body: JSON.stringify(data),
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

export async function getDashboardOverview() {
  const data = await get('/dashboard/overview')

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
