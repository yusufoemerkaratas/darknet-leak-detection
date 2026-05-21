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

export async function getDashboardOverview() {
  const data = await get('/dashboard/overview')

  return {
    ...data,
    findings: (data.findings ?? []).map(mapFinding),
    critical_alerts: (data.critical_alerts ?? []).map(mapFinding),
  }
}
