export type SeverityLevel = 'critical' | 'medium' | 'low'

export function severityFromScore(riskScore: number): SeverityLevel {
  if (riskScore >= 90) return 'critical'
  if (riskScore >= 75) return 'medium'
  return 'low'
}

export function severityLabel(riskScore: number): string {
  const s = severityFromScore(riskScore)
  return s.charAt(0).toUpperCase() + s.slice(1)
}
