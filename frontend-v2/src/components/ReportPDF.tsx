import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer'

// ─── Styles — professional monochrome (German corporate standard) ─────────────

const s = StyleSheet.create({
  page: {
    padding: 52,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1a1a1a',
    backgroundColor: '#ffffff',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
  },
  logoBlock: { flexDirection: 'column' },
  logoText: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000', letterSpacing: -0.5 },
  logoAccent: { color: '#2563eb' },
  logoSub: { fontSize: 7, color: '#666666', marginTop: 3, letterSpacing: 1.5 },
  headerRight: { alignItems: 'flex-end' },
  reportLabel: { fontSize: 8, color: '#555555', textTransform: 'uppercase', letterSpacing: 1 },
  reportDate: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#000000', marginTop: 3 },

  // Section
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.75,
    borderBottomColor: '#333333',
    borderBottomStyle: 'solid',
    textTransform: 'uppercase',
    letterSpacing: 0.75,
  },
  section: { marginBottom: 22 },

  // Stat cards row
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statCard: {
    flex: 1,
    padding: 10,
    borderWidth: 0.75,
    borderColor: '#CCCCCC',
    borderStyle: 'solid',
    backgroundColor: '#F8F8F8',
  },
  statLabel: { fontSize: 7, color: '#666666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#000000' },
  statSub: { fontSize: 7, color: '#888888', marginTop: 3 },
  statDot: { width: 6, height: 6, marginBottom: 6 },

  // Table
  table: {
    width: '100%',
    borderWidth: 0.75,
    borderColor: '#CCCCCC',
    borderStyle: 'solid',
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#ECECEC',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.75,
    borderBottomColor: '#BBBBBB',
    borderBottomStyle: 'solid',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E8E8',
    borderBottomStyle: 'solid',
  },
  tableRowAlt: { backgroundColor: '#F5F5F5' },
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#222222', textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { fontSize: 8, color: '#333333' },

  // Badge — monochrome, border only
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderWidth: 0.5,
    borderColor: '#888888',
    borderStyle: 'solid',
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#222222',
  },
  badgeCritical: { borderColor: '#000000', color: '#000000' },
  badgeHigh:     { borderColor: '#000000', color: '#000000' },
  badgeMedium:   { borderColor: '#555555', color: '#333333' },
  badgeLow:      { borderColor: '#999999', color: '#555555' },

  // Severity summary
  sevRow: { flexDirection: 'row', gap: 8 },
  sevCard: {
    flex: 1,
    padding: 14,
    borderWidth: 0.75,
    borderStyle: 'solid',
    borderColor: '#CCCCCC',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  sevCritical: { borderColor: '#555555', borderWidth: 1 },
  sevMedium:   { borderColor: '#888888' },
  sevLow:      { borderColor: '#BBBBBB' },
  sevCount:    { fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  sevLabel:    { fontSize: 7.5, textTransform: 'uppercase', letterSpacing: 0.75 },
  sevCountCrit: { color: '#000000' },
  sevCountMed:  { color: '#333333' },
  sevCountLow:  { color: '#555555' },
  sevLabelCrit: { color: '#000000' },
  sevLabelMed:  { color: '#444444' },
  sevLabelLow:  { color: '#666666' },

  // Filter badge row
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 0.75,
    borderBottomColor: '#CCCCCC',
    borderBottomStyle: 'solid',
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 0.75,
    marginRight: 4,
  },
  filterChip: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 0.5,
    borderColor: '#AAAAAA',
    borderStyle: 'solid',
    fontSize: 7.5,
    color: '#333333',
  },
  chipCompany:     { color: '#222222' },
  chipSevCritical: { color: '#000000', fontFamily: 'Helvetica-Bold' },
  chipSevMedium:   { color: '#333333' },
  chipSevLow:      { color: '#555555' },
  chipAll:         { color: '#555555' },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 52,
    right: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 0.75,
    borderTopColor: '#CCCCCC',
    borderTopStyle: 'solid',
  },
  footerText: { fontSize: 7, color: '#888888' },
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface Finding {
  id: number
  company: string
  type: string
  severity: string
  risk_score: number
  status: string
  detected_at: string
  source: string
}

interface ReportData {
  generatedAt: string
  summary: {
    total_findings: number
    critical_alerts: number
    reviewed_findings: number
    monitored_companies: number
    latest_collection?: string
  }
  severity: { critical: number; medium: number; low: number }
  findings: Finding[]
  filters?: {
    companies: string[]   // empty = all
    severities: string[]  // empty = all
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreToSeverity(score: number): 'critical' | 'medium' | 'low' {
  if (score >= 90) return 'critical'
  if (score >= 75) return 'medium'
  return 'low'
}

function badgeStyle(score: number) {
  const sev = scoreToSeverity(score)
  if (sev === 'critical') return [s.badge, s.badgeCritical]
  if (sev === 'medium')   return [s.badge, s.badgeMedium]
  return [s.badge, s.badgeLow]
}

function scoreLabel(score: number): string {
  const sev = scoreToSeverity(score)
  return sev.charAt(0).toUpperCase() + sev.slice(1)
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

function ReportDocument({ data }: { data: ReportData }) {
  const now = new Date(data.generatedAt)
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' UTC'
  const reviewedPct = Math.round(
    (data.summary.reviewed_findings / Math.max(data.summary.total_findings, 1)) * 100
  )

  return (
    <Document
      title="DarkLeak Threat Intelligence Report"
      author="DarkLeak Platform"
      subject="Threat Intelligence Report"
    >
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.logoBlock}>
            <Text style={s.logoText}>
              {'Dark'}<Text style={s.logoAccent}>{'Leak'}</Text>
            </Text>
            <Text style={s.logoSub}>DARKNET THREAT INTELLIGENCE PLATFORM</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.reportLabel}>Threat Intelligence Report</Text>
            <Text style={s.reportDate}>{dateStr}</Text>
            <Text style={[s.reportLabel, { marginTop: 2 }]}>{timeStr}</Text>
          </View>
        </View>

        {/* Applied Filters */}
        {data.filters && (data.filters.companies.length > 0 || data.filters.severities.length > 0) && (
          <View style={s.filterBar}>
            <Text style={s.filterLabel}>Filters:</Text>

            {data.filters.severities.length > 0 ? (
              data.filters.severities.map((sev) => (
                <Text
                  key={sev}
                  style={[
                    s.filterChip,
                    sev === 'critical' ? s.chipSevCritical :
                    sev === 'medium'   ? s.chipSevMedium   : s.chipSevLow,
                  ]}
                >
                  {sev.charAt(0).toUpperCase() + sev.slice(1)} severity
                </Text>
              ))
            ) : (
              <Text style={[s.filterChip, s.chipAll]}>All severities</Text>
            )}

            {data.filters.companies.length > 0 ? (
              data.filters.companies.map((c) => (
                <Text key={c} style={[s.filterChip, s.chipCompany]}>{c}</Text>
              ))
            ) : (
              <Text style={[s.filterChip, s.chipAll]}>All companies</Text>
            )}
          </View>
        )}

        {/* Executive Summary */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Executive Summary</Text>
          <View style={s.statRow}>
            <View style={s.statCard}>
              <View style={[s.statDot, { backgroundColor: '#333333' }]} />
              <Text style={s.statLabel}>Total Findings</Text>
              <Text style={s.statValue}>{data.summary.total_findings.toLocaleString()}</Text>
              {data.summary.latest_collection && (
                <Text style={s.statSub}>Last: {data.summary.latest_collection}</Text>
              )}
            </View>
            <View style={s.statCard}>
              <View style={[s.statDot, { backgroundColor: '#000000' }]} />
              <Text style={s.statLabel}>Critical Alerts</Text>
              <Text style={s.statValue}>{data.summary.critical_alerts}</Text>
              <Text style={s.statSub}>Require immediate attention</Text>
            </View>
            <View style={s.statCard}>
              <View style={[s.statDot, { backgroundColor: '#555555' }]} />
              <Text style={s.statLabel}>Reviewed</Text>
              <Text style={[s.statValue, { color: '#333333' }]}>{data.summary.reviewed_findings.toLocaleString()}</Text>
              <Text style={s.statSub}>{reviewedPct}% of total findings</Text>
            </View>
            <View style={s.statCard}>
              <View style={[s.statDot, { backgroundColor: '#888888' }]} />
              <Text style={s.statLabel}>Companies Monitored</Text>
              <Text style={[s.statValue, { color: '#555555' }]}>{data.summary.monitored_companies}</Text>
              <Text style={s.statSub}>Active threat profiles</Text>
            </View>
          </View>
        </View>

        {/* Severity Distribution */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Severity Distribution</Text>
          <View style={s.sevRow}>
            <View style={[s.sevCard, s.sevCritical]}>
              <Text style={[s.sevCount, s.sevCountCrit]}>{data.severity.critical}</Text>
              <Text style={[s.sevLabel, s.sevLabelCrit]}>Critical</Text>
            </View>
            <View style={[s.sevCard, s.sevMedium]}>
              <Text style={[s.sevCount, s.sevCountMed]}>{data.severity.medium}</Text>
              <Text style={[s.sevLabel, s.sevLabelMed]}>Medium</Text>
            </View>
            <View style={[s.sevCard, s.sevLow]}>
              <Text style={[s.sevCount, s.sevCountLow]}>{data.severity.low}</Text>
              <Text style={[s.sevLabel, s.sevLabelLow]}>Low</Text>
            </View>
          </View>
        </View>

        {/* Recent Findings Table */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Recent Findings ({data.findings.length} records)</Text>
          <View style={s.table}>
            <View style={s.tableHead}>
              <Text style={[s.th, { flex: 0.5 }]}>ID</Text>
              <Text style={[s.th, { flex: 2 }]}>Company / Source</Text>
              <Text style={[s.th, { flex: 1 }]}>Severity</Text>
              <Text style={[s.th, { flex: 0.8, textAlign: 'center' }]}>Risk Score</Text>
              <Text style={[s.th, { flex: 1.5 }]}>Status</Text>
              <Text style={[s.th, { flex: 2 }]}>Detected At</Text>
            </View>
            {data.findings.map((f, i) => (
              <View key={f.id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                <Text style={[s.td, { flex: 0.5, color: '#999999' }]}>#{f.id}</Text>
                <Text style={[s.td, { flex: 2 }]} numberOfLines={1}>
                  {f.company !== 'Unknown' ? f.company : f.source}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={badgeStyle(f.risk_score)}>{scoreLabel(f.risk_score)}</Text>
                </View>
                <Text style={[s.td, { flex: 0.8, textAlign: 'center' }]}>{f.risk_score}</Text>
                <Text style={[s.td, { flex: 1.5, color: '#666666' }]}>{f.status}</Text>
                <Text style={[s.td, { flex: 2, color: '#999999' }]}>{f.detected_at}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DarkLeak Threat Intelligence Platform — Confidential</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

// ─── Download Button ──────────────────────────────────────────────────────────

interface Props {
  data: ReportData | null
}

export function ReportDownloadButton({ data }: Props) {
  if (!data) return null

  const filename = `darkleak-report-${new Date().toISOString().slice(0, 10)}.pdf`

  return (
    <PDFDownloadLink document={<ReportDocument data={data} />} fileName={filename}>
      {({ loading }) => (
        <button
          disabled={loading}
          className="flex items-center gap-2 h-8 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--primary)]/50 text-xs font-medium disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Preparing…
            </>
          ) : (
            <>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v7.44l1.97-1.97a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L6.22 10.28a.75.75 0 1 1 1.06-1.06l1.97 1.97V3.75A.75.75 0 0 1 10 3ZM3.75 15a.75.75 0 0 0 0 1.5h12.5a.75.75 0 0 0 0-1.5H3.75Z" clipRule="evenodd" />
              </svg>
              Export PDF
            </>
          )}
        </button>
      )}
    </PDFDownloadLink>
  )
}

export type { ReportData }

// ─── Findings Page PDF ────────────────────────────────────────────────────────

export interface FindingsReportData {
  generatedAt: string
  filterLabel: string
  filters?: {
    companies: string[]
    severities: string[]
  }
  findings: Array<{
    id: number
    title: string
    company: string
    classification: string
    risk_score: number
    is_reviewed: boolean
    is_false_positive: boolean
    created_at: string
  }>
}

function FindingsReportDocument({ data }: { data: FindingsReportData }) {
  const now = new Date(data.generatedAt)
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' UTC'

  const critical  = data.findings.filter((f) => f.risk_score >= 90).length
  const medium    = data.findings.filter((f) => f.risk_score >= 75 && f.risk_score < 90).length
  const low       = data.findings.filter((f) => f.risk_score < 75).length
  const reviewed  = data.findings.filter((f) => f.is_reviewed).length
  const fp        = data.findings.filter((f) => f.is_false_positive).length
  const companies = new Set(data.findings.map((f) => f.company)).size

  const statusLabel = (f: FindingsReportData['findings'][0]) => {
    if (f.is_false_positive) return 'False Positive'
    if (f.is_reviewed) return 'Reviewed'
    return 'Pending'
  }

  const filterChipStyle = (label: string) => {
    if (label === 'All findings') return [s.filterChip, s.chipAll]
    if (label === 'Pending') return [s.filterChip, s.chipSevCritical]
    if (label === 'Reviewed') return [s.filterChip, s.chipAll]
    return [s.filterChip, s.chipAll]
  }

  return (
    <Document
      title="DarkLeak Threat Findings Report"
      author="DarkLeak Platform"
      subject="Threat Findings Report"
    >
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.logoBlock}>
            <Text style={s.logoText}>
              {'Dark'}<Text style={s.logoAccent}>{'Leak'}</Text>
            </Text>
            <Text style={s.logoSub}>DARKNET THREAT INTELLIGENCE PLATFORM</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.reportLabel}>Threat Findings Report</Text>
            <Text style={s.reportDate}>{dateStr}</Text>
            <Text style={[s.reportLabel, { marginTop: 2 }]}>{timeStr}</Text>
          </View>
        </View>

        {/* Filter chips */}
        <View style={s.filterBar}>
          <Text style={s.filterLabel}>View:</Text>
          <Text style={filterChipStyle(data.filterLabel) as any}>{data.filterLabel}</Text>
          {data.filters && data.filters.companies.length > 0 && (
            <>
              <Text style={[s.filterLabel, { marginLeft: 4 }]}>Companies:</Text>
              {data.filters.companies.map((c) => (
                <Text key={c} style={[s.filterChip, s.chipCompany]}>{c}</Text>
              ))}
            </>
          )}
          {data.filters && data.filters.severities.length > 0 && (
            <>
              <Text style={[s.filterLabel, { marginLeft: 4 }]}>Severity:</Text>
              {data.filters.severities.map((sv) => (
                <Text
                  key={sv}
                  style={[
                    s.filterChip,
                    sv === 'critical' ? s.chipSevCritical : sv === 'medium' ? s.chipSevMedium : s.chipSevLow,
                  ]}
                >
                  {sv.charAt(0).toUpperCase() + sv.slice(1)}
                </Text>
              ))}
            </>
          )}
          <Text style={[s.filterLabel, { marginLeft: 8 }]}>Total:</Text>
          <Text style={[s.filterChip, s.chipAll]}>{data.findings.length} findings</Text>
        </View>

        {/* Summary cards */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Summary</Text>
          <View style={s.statRow}>
            <View style={s.statCard}>
              <View style={[s.statDot, { backgroundColor: '#000000' }]} />
              <Text style={s.statLabel}>Critical</Text>
              <Text style={s.statValue}>{critical}</Text>
              <Text style={s.statSub}>risk score ≥ 90</Text>
            </View>
            <View style={s.statCard}>
              <View style={[s.statDot, { backgroundColor: '#555555' }]} />
              <Text style={s.statLabel}>Medium</Text>
              <Text style={[s.statValue, { color: '#333333' }]}>{medium}</Text>
              <Text style={s.statSub}>risk score 75–89</Text>
            </View>
            <View style={s.statCard}>
              <View style={[s.statDot, { backgroundColor: '#888888' }]} />
              <Text style={s.statLabel}>Low</Text>
              <Text style={[s.statValue, { color: '#555555' }]}>{low}</Text>
              <Text style={s.statSub}>risk score &lt; 75</Text>
            </View>
            <View style={s.statCard}>
              <View style={[s.statDot, { backgroundColor: '#AAAAAA' }]} />
              <Text style={s.statLabel}>Reviewed / FP</Text>
              <Text style={[s.statValue, { color: '#666666' }]}>{reviewed}</Text>
              <Text style={s.statSub}>{fp} false positives</Text>
            </View>
            <View style={s.statCard}>
              <View style={[s.statDot, { backgroundColor: '#CCCCCC' }]} />
              <Text style={s.statLabel}>Companies</Text>
              <Text style={[s.statValue, { color: '#888888' }]}>{companies}</Text>
              <Text style={s.statSub}>unique companies</Text>
            </View>
          </View>
        </View>

        {/* Findings Table */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Findings ({data.findings.length} records)</Text>
          <View style={s.table}>
            <View style={s.tableHead}>
              <Text style={[s.th, { flex: 0.4 }]}>ID</Text>
              <Text style={[s.th, { flex: 3 }]}>Title</Text>
              <Text style={[s.th, { flex: 1.5 }]}>Company</Text>
              <Text style={[s.th, { flex: 1 }]}>Severity</Text>
              <Text style={[s.th, { flex: 0.6, textAlign: 'center' }]}>Score</Text>
              <Text style={[s.th, { flex: 1.2 }]}>Status</Text>
              <Text style={[s.th, { flex: 1.4 }]}>Date</Text>
            </View>
            {data.findings.map((f, i) => (
              <View key={f.id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                <Text style={[s.td, { flex: 0.4, color: '#999999' }]}>#{f.id}</Text>
                <Text style={[s.td, { flex: 3 }]} numberOfLines={1}>{f.title}</Text>
                <Text style={[s.td, { flex: 1.5, color: '#666666' }]} numberOfLines={1}>{f.company}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={badgeStyle(f.risk_score)}>{scoreLabel(f.risk_score)}</Text>
                </View>
                <Text style={[s.td, { flex: 0.6, textAlign: 'center' }]}>{f.risk_score}</Text>
                <Text style={[s.td, { flex: 1.2, color: '#666666' }]}>{statusLabel(f)}</Text>
                <Text style={[s.td, { flex: 1.4, color: '#999999' }]}>
                  {new Date(f.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DarkLeak Threat Intelligence Platform — Confidential</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

// ─── Single Finding PDF ───────────────────────────────────────────────────────

export interface FindingDetailPdfData {
  id: number
  title: string
  company: string
  classification: string
  risk_score: number
  is_reviewed: boolean
  is_false_positive: boolean
  review_notes: string | null
  created_at: string
  raw_url?: string | null
  analysis_result: {
    classification_rule: string
    matched_companies: Array<{ company_name: string; match_type: string; matched_term: string }>
    terminology_hits: Array<{ term: string; priority: string; count: number }>
    score_contributors: Record<string, number>
  } | null
}

function FindingDetailDocument({ data }: { data: FindingDetailPdfData }) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' UTC'
  const sev = scoreToSeverity(data.risk_score)
  const sevLbl = scoreLabel(data.risk_score)
  const sevColor = sev === 'critical' ? '#000000' : sev === 'medium' ? '#333333' : '#555555'
  const statusLabel = data.is_false_positive ? 'False Positive' : data.is_reviewed ? 'Reviewed' : 'Pending Review'
  const contributors = data.analysis_result
    ? Object.entries(data.analysis_result.score_contributors).filter(([, v]) => v !== 0)
    : []

  return (
    <Document title={`DarkLeak — ${data.title}`} author="DarkLeak Platform">
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.logoBlock}>
            <Text style={s.logoText}>{'Dark'}<Text style={s.logoAccent}>{'Leak'}</Text></Text>
            <Text style={s.logoSub}>DARKNET THREAT INTELLIGENCE PLATFORM</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.reportLabel}>Finding Detail Report</Text>
            <Text style={s.reportDate}>{dateStr}</Text>
            <Text style={[s.reportLabel, { marginTop: 2 }]}>{timeStr}</Text>
          </View>
        </View>

        {/* Finding identity */}
        <View style={{ marginBottom: 20, paddingBottom: 16, borderBottomWidth: 0.75, borderBottomColor: '#CCCCCC', borderBottomStyle: 'solid' }}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
            <Text style={s.badge}>{data.classification}</Text>
            <Text style={badgeStyle(data.risk_score)}>{sevLbl}</Text>
            {data.is_false_positive && (
              <Text style={s.badge}>False Positive</Text>
            )}
            {data.is_reviewed && !data.is_false_positive && (
              <Text style={s.badge}>Reviewed</Text>
            )}
          </View>
          <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#000000', marginBottom: 5 }}>{data.title}</Text>
          <Text style={{ fontSize: 8, color: '#666666' }}>
            {'Company: '}{data.company}{'  ·  Detected: '}{new Date(data.created_at).toLocaleDateString('en-GB')}{'  ·  Finding #'}{data.id}
          </Text>
        </View>

        {/* Source URL */}
        {data.raw_url ? (
          <View style={[s.section, { backgroundColor: '#F8F8F8', padding: 10, borderWidth: 0.75, borderColor: '#CCCCCC', borderStyle: 'solid' }]}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Source URL</Text>
            <Text style={{ fontSize: 8, color: '#555555' }}>{data.raw_url}</Text>
          </View>
        ) : null}

        {/* Review note */}
        {data.review_notes ? (
          <View style={[s.section, { backgroundColor: '#F8F8F8', padding: 12, borderWidth: 0.75, borderColor: '#CCCCCC', borderStyle: 'solid' }]}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#333333', marginBottom: 4 }}>
              {data.is_false_positive ? 'False Positive Note' : 'Review Note'}
            </Text>
            <Text style={{ fontSize: 9, color: '#555555', lineHeight: 1.5 }}>{data.review_notes}</Text>
          </View>
        ) : null}

        {/* Risk Assessment */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Risk Assessment</Text>
          <View style={s.statRow}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Risk Score</Text>
              <Text style={[s.statValue, { color: sevColor }]}>{data.risk_score}</Text>
              <Text style={s.statSub}>out of 100</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Severity</Text>
              <Text style={[s.statValue, { fontSize: 16, color: sevColor }]}>{sevLbl}</Text>
              <Text style={s.statSub}>based on risk score</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Classification</Text>
              <Text style={[s.statValue, { fontSize: 13, color: '#000000' }]}>{data.classification}</Text>
              <Text style={s.statSub}>threat type</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Status</Text>
              <Text style={[s.statValue, { fontSize: 12, color: '#000000' }]}>{statusLabel}</Text>
              <Text style={s.statSub}>review status</Text>
            </View>
          </View>
        </View>

        {/* Analysis */}
        {data.analysis_result && data.analysis_result.classification_rule ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Analysis</Text>
            <View style={{ backgroundColor: '#F8F8F8', padding: 10, borderWidth: 0.75, borderColor: '#CCCCCC', borderStyle: 'solid' }}>
              <Text style={{ fontSize: 9, color: '#333333', lineHeight: 1.6 }}>{data.analysis_result.classification_rule}</Text>
            </View>
          </View>
        ) : null}

        {/* Matched Companies */}
        {data.analysis_result && data.analysis_result.matched_companies.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{'Matched Companies ('}{data.analysis_result.matched_companies.length}{')'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {data.analysis_result.matched_companies.map((c, i) => (
                <Text key={i} style={s.badge}>{c.company_name}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {/* Terminology Hits */}
        {data.analysis_result && data.analysis_result.terminology_hits.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Terminology Hits</Text>
            <View style={s.table}>
              <View style={s.tableHead}>
                <Text style={[s.th, { flex: 2 }]}>Term</Text>
                <Text style={[s.th, { flex: 1 }]}>Priority</Text>
                <Text style={[s.th, { flex: 0.5, textAlign: 'right' }]}>Count</Text>
              </View>
              {data.analysis_result.terminology_hits.map((h, i) => (
                <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                  <Text style={[s.td, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>{h.term}</Text>
                  <Text style={[s.td, { flex: 1 }]}>{h.priority}</Text>
                  <Text style={[s.td, { flex: 0.5, textAlign: 'right' }]}>{h.count}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Score Breakdown */}
        {contributors.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Score Breakdown</Text>
            <View style={s.table}>
              <View style={s.tableHead}>
                <Text style={[s.th, { flex: 3 }]}>Factor</Text>
                <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Points</Text>
              </View>
              {contributors.map(([key, val]) => (
                <View key={key} style={s.tableRow}>
                  <Text style={[s.td, { flex: 3 }]}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                  <Text style={[s.td, { flex: 1, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{val}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>DarkLeak Threat Intelligence Platform — Confidential</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export function FindingDetailDownloadButton({ data }: { data: FindingDetailPdfData | null }) {
  if (!data) return null
  const filename = `darkleak-finding-${data.id}-${new Date().toISOString().slice(0, 10)}.pdf`
  return (
    <PDFDownloadLink document={<FindingDetailDocument data={data} />} fileName={filename}>
      {({ loading }) => (
        <button
          disabled={loading}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--primary)]/50 text-xs font-medium disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {loading ? (
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v7.44l1.97-1.97a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L6.22 10.28a.75.75 0 1 1 1.06-1.06l1.97 1.97V3.75A.75.75 0 0 1 10 3ZM3.75 15a.75.75 0 0 0 0 1.5h12.5a.75.75 0 0 0 0-1.5H3.75Z" clipRule="evenodd" />
            </svg>
          )}
          Export PDF
        </button>
      )}
    </PDFDownloadLink>
  )
}

export function FindingsReportDownloadButton({ data }: { data: FindingsReportData | null }) {
  if (!data) return null

  const filename = `darkleak-findings-${new Date().toISOString().slice(0, 10)}.pdf`

  return (
    <PDFDownloadLink document={<FindingsReportDocument data={data} />} fileName={filename}>
      {({ loading }) => (
        <button
          disabled={loading}
          className="flex items-center gap-2 h-8 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--primary)]/50 text-xs font-medium disabled:opacity-50 disabled:cursor-wait transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Preparing…
            </>
          ) : (
            <>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v7.44l1.97-1.97a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L6.22 10.28a.75.75 0 1 1 1.06-1.06l1.97 1.97V3.75A.75.75 0 0 1 10 3ZM3.75 15a.75.75 0 0 0 0 1.5h12.5a.75.75 0 0 0 0-1.5H3.75Z" clipRule="evenodd" />
              </svg>
              Export PDF
            </>
          )}
        </button>
      )}
    </PDFDownloadLink>
  )
}
