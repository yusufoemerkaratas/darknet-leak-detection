export interface Source {
  id: number
  name: string
  url: string
  is_active: boolean
}

export interface SourceCreate {
  name: string
  url: string
}

export interface SourceHealth {
  source_id: number
  is_reachable: boolean
  last_checked: string | null
  response_time_ms: number | null
  error: string | null
}

export interface SourceMetrics {
  source_id: number
  total_records: number
  last_crawl: string | null
  success_rate: number | null
  avg_records_per_crawl: number | null
}

export interface Company {
  id: number
  name: string
}

export interface CompanyCreate {
  name: string
}

export interface CrawlJob {
  id: number
  source_id: number
  status: string
  total_records: number
  inserted_records: number
  duplicate_records: number
  started_at: string
  finished_at: string | null
}

export interface Finding {
  id: number
  title: string
  company: string
  classification: string
  risk_score: number
  created_at: string
  raw_url?: string | null
}

export interface SeverityCounts {
  critical: number
  medium: number
  low: number
}

export interface MatchedCompany {
  company_name: string
  match_type: string
  matched_term: string
  confidence: number
  similarity_score: number
}

export interface TerminologyHit {
  term: string
  priority: string
  count: number
  line_numbers: number[]
  context: string[]
}

export interface FindingDetail extends Finding {
  severity: string
  is_reviewed: boolean
  is_false_positive: boolean
  review_notes: string | null
  analysis_result: {
    id: number
    leak_record_id: number
    detected_patterns: {
      patterns: string[]
      parser: { language: string; is_code: boolean; noise_score: number }
      llm_enrichment?: { status: string; explanation: string; model: string }
    }
    matched_companies: MatchedCompany[]
    terminology_hits: TerminologyHit[]
    score_contributors: Record<string, number>
    classification_rule: string
    created_at: string
  } | null
}

export interface Alert {
  id: number
  leak_record_id: number
  company_id: number
  finding_title: string
  severity: string
  company: string
  is_reviewed: boolean
  review_notes: string | null
  risk_score: number
  classification: string | null
  created_at: string
}

export interface Paginated<T> {
  page: number
  size: number
  total: number
  items: T[]
}

export interface Stats {
  total_records: number
  pending_analysis: number
  analyzed: number
  total_emails_found: number
  largest_leak_mb: number | null
  latest_collection: string | null
  records_per_source: Record<string, number>
}

export interface DashboardOverview {
  total_findings: number
  open_alerts: number
  critical_alerts: number
  findings_today: number
  top_companies: { company_id: number; name: string; count: number }[]
  recent_findings: Finding[]
}

export interface FindingsByDay {
  date: string
  count: number
}

export interface AlertsBySeverity {
  severity: string
  count: number
}

export interface FindingsBySeverity {
  classification: string
  count: number
}

export type Theme = 'light' | 'dark' | 'system'
