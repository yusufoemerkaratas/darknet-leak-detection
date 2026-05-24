import { startTransition, useEffect, useState } from 'react'
import {
  Activity,
  BadgeCheck,
  Building2,
  ShieldAlert,
} from 'lucide-react'
import StatCard from '../components/cards/StatCard'
import CompaniesBarChart from '../components/charts/CompaniesBarChart'
import FindingsLineChart from '../components/charts/FindingsLineChart'
import SeverityDonutChart from '../components/charts/SeverityDonutChart'
import DataSourcesCard from '../components/dashboard/DataSourcesCard'
import DetectionEngineStatus from '../components/dashboard/DetectionEngineStatus'
import FindingDetailModal from '../components/dashboard/FindingDetailModal'
import LatestCriticalAlerts from '../components/dashboard/LatestCriticalAlerts'
import LiveMonitoringFeed from '../components/dashboard/LiveMonitoringFeed'
import RecentFindings from '../components/dashboard/RecentFindings'
import ReportModal from '../components/dashboard/ReportModal'
import SeverityLegend from '../components/dashboard/SeverityLegend'
import StatusCard from '../components/cards/StatusCard'
import DashboardShell from '../components/layout/DashboardShell'
import {
  getDashboardOverview,
  getFindingDetail,
  updateFindingStatus,
} from '../api/client'
import { severityTheme } from '../styles/theme'

const ITEMS_PER_PAGE = 3
const REFRESH_INTERVAL_MS = 30000

function normalizeSearchTerm(value) {
  return value.trim().toLowerCase()
}

function findingMatchesSearch(finding, searchTerm) {
  if (!searchTerm) return true

  return [
    finding.company,
    finding.type,
    finding.source,
    finding.affected,
    finding.status,
    finding.detectedAt,
    String(finding.riskScore),
  ]
    .join(' ')
    .toLowerCase()
    .includes(searchTerm)
}

function feedMatchesSearch(item, searchTerm) {
  if (!searchTerm) return true

  return [item.title, item.company, item.time].join(' ').toLowerCase().includes(searchTerm)
}

function isResolvedStatus(status) {
  return status === 'Reviewed' || status === 'False Positive'
}

function parseFindingDate(value) {
  return new Date(`${value.replace(' ', 'T')}:00Z`)
}

function buildTimelineFromFindings(findings, generatedAt) {
  const baseDate = generatedAt ? new Date(generatedAt) : new Date()
  const buckets = new Map()

  for (let offset = 6; offset >= 0; offset -= 1) {
    const current = new Date(baseDate)
    current.setUTCDate(baseDate.getUTCDate() - offset)
    const key = current.toISOString().slice(0, 10)
    buckets.set(key, {
      date: current.toLocaleDateString('en-GB', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }),
      findings: 0,
    })
  }

  findings.forEach((finding) => {
    const key = parseFindingDate(finding.detectedAt).toISOString().slice(0, 10)
    if (buckets.has(key)) {
      buckets.get(key).findings += 1
    }
  })

  return [...buckets.values()]
}

function exportDashboardReport({ findings, summary, severityData, generatedAt, context }) {
  const reportWindow = window.open('', '_blank', 'noopener,noreferrer,width=1080,height=860')
  if (!reportWindow) return

  const severityRows = severityData
    .map(
      (item) =>
        `<tr><td>${item.label}</td><td style="text-align:right;">${item.value}</td></tr>`
    )
    .join('')

  const findingRows = findings
    .map(
      (finding) => `
        <tr>
          <td>${finding.company}</td>
          <td>${finding.type}</td>
          <td>${finding.severity}</td>
          <td>${finding.riskScore}</td>
          <td>${finding.status}</td>
          <td>${finding.detectedAt}</td>
        </tr>
      `
    )
    .join('')

  reportWindow.document.write(`
    <html>
      <head>
        <title>Leak Detection Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
          h1 { margin-bottom: 8px; }
          p { color: #4b5563; }
          .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
          .card { border: 1px solid #d1d5db; border-radius: 12px; padding: 14px; }
          .label { font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; }
          .value { font-size: 24px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 8px; text-align: left; font-size: 13px; }
          th { color: #374151; }
          .split { display: grid; grid-template-columns: 280px 1fr; gap: 24px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <h1>${context.title}</h1>
        <p>Generated ${generatedAt}</p>
        <p>${context.subtitle}</p>
        <div class="grid">
          <div class="card"><div class="label">Total Findings</div><div class="value">${summary.totalFindings}</div></div>
          <div class="card"><div class="label">Critical Alerts</div><div class="value">${summary.criticalAlerts}</div></div>
          <div class="card"><div class="label">Reviewed</div><div class="value">${summary.reviewedFindings}</div></div>
          <div class="card"><div class="label">Companies</div><div class="value">${summary.monitoredCompanies}</div></div>
        </div>
        <div class="split">
          <div>
            <h2>Severity Breakdown</h2>
            <table>
              <tbody>${severityRows}</tbody>
            </table>
          </div>
          <div>
            <h2>Findings</h2>
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Score</th>
                  <th>Status</th>
                  <th>Detected At</th>
                </tr>
              </thead>
              <tbody>${findingRows}</tbody>
            </table>
          </div>
        </div>
      </body>
    </html>
  `)
  reportWindow.document.close()
  reportWindow.focus()
  reportWindow.print()
}

function Dashboard() {
  const [activeItem, setActiveItem] = useState('dashboard')
  const [searchValue, setSearchValue] = useState('')
  const [companyFilter, setCompanyFilter] = useState('All Companies')
  const [severityFilter, setSeverityFilter] = useState('All Severity')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [sortBy, setSortBy] = useState('score-desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [dashboardData, setDashboardData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedFindingId, setSelectedFindingId] = useState(null)
  const [selectedFindingDetail, setSelectedFindingDetail] = useState(null)
  const [isFindingDetailLoading, setIsFindingDetailLoading] = useState(false)
  const [findingDetailError, setFindingDetailError] = useState('')
  const [isUpdatingFindingStatus, setIsUpdatingFindingStatus] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)

  useEffect(() => {
    let isActive = true

    async function loadDashboard() {
      setIsLoading(true)
      setLoadError('')

      try {
        const data = await getDashboardOverview()
        if (!isActive) return

        startTransition(() => {
          setDashboardData(data)
          setCurrentPage(1)
        })
      } catch (error) {
        if (!isActive) return
        setLoadError(error.message || 'Failed to load dashboard data.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadDashboard()
    const intervalId = window.setInterval(loadDashboard, REFRESH_INTERVAL_MS)

    return () => {
      isActive = false
      window.clearInterval(intervalId)
    }
  }, [])

  const findings = dashboardData?.findings ?? []
  const liveFeed = dashboardData?.live_feed ?? []
  const timelineData = dashboardData?.timeline ?? []
  const dataSources = dashboardData?.data_sources ?? []
  const criticalAlertsData = dashboardData?.critical_alerts ?? []
  const topCompaniesData = dashboardData?.top_companies ?? []
  const severityBreakdown = dashboardData?.severity_breakdown ?? []
  const severityLegend = dashboardData?.severity_legend ?? []
  const sidebarStatusCards = dashboardData?.sidebar_status_cards ?? []
  const detectionEngine = dashboardData?.detection_engine ?? {
    model_status: 'Offline',
    success_rate: 0,
  }
  const summary = dashboardData?.summary ?? {
    total_findings: 0,
    critical_alerts: 0,
    reviewed_findings: 0,
    monitored_companies: 0,
    latest_collection: 'No scan data',
  }

  const syncFindingAcrossDashboard = (updatedFinding) => {
    setDashboardData((currentData) => {
      if (!currentData) return currentData

      const nextFindings = (currentData.findings ?? []).map((finding) =>
        finding.id === updatedFinding.id ? { ...finding, ...updatedFinding } : finding
      )
      const reviewedFindings = nextFindings.filter((finding) =>
        isResolvedStatus(finding.status)
      ).length

      return {
        ...currentData,
        findings: nextFindings,
        critical_alerts: (currentData.critical_alerts ?? []).map((finding) =>
          finding.id === updatedFinding.id ? { ...finding, ...updatedFinding } : finding
        ),
        summary: {
          ...currentData.summary,
          reviewed_findings: reviewedFindings,
        },
      }
    })
  }
  const normalizedSearchTerm = normalizeSearchTerm(searchValue)
  const hasActiveSearch = normalizedSearchTerm.length > 0
  const hasCompanyFocus = companyFilter !== 'All Companies'
  const hasActiveFilterContext =
    hasActiveSearch ||
    companyFilter !== 'All Companies' ||
    severityFilter !== 'All Severity' ||
    statusFilter !== 'All Status'

  const companyOptions = [...new Set(findings.map((finding) => finding.company))]

  const filteredFindings = (() => {
    return findings.filter((finding) => {
      const searchMatch = findingMatchesSearch(finding, normalizedSearchTerm)
      const companyMatch =
        companyFilter === 'All Companies' || finding.company === companyFilter
      const severityMatch =
        severityFilter === 'All Severity' || finding.severity === severityFilter
      const statusMatch = statusFilter === 'All Status' || finding.status === statusFilter

      return searchMatch && companyMatch && severityMatch && statusMatch
    })
  })()

  const sortedFindings = (() => {
    const sorted = [...filteredFindings]

    sorted.sort((left, right) => {
      if (sortBy === 'score-desc') return right.riskScore - left.riskScore
      if (sortBy === 'score-asc') return left.riskScore - right.riskScore
      if (sortBy === 'newest') {
        return new Date(right.detectedAt) - new Date(left.detectedAt)
      }
      if (sortBy === 'oldest') {
        return new Date(left.detectedAt) - new Date(right.detectedAt)
      }
      return 0
    })

    return sorted
  })()

  const totalPages = Math.max(1, Math.ceil(sortedFindings.length / ITEMS_PER_PAGE))
  const paginatedFindings = sortedFindings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const criticalAlerts = [...findings]
    .filter((finding) => finding.severity === 'Critical' || finding.severity === 'High')
    .sort((left, right) => right.riskScore - left.riskScore)
    .slice(0, 3)
  const alertSource = criticalAlertsData.length > 0 ? criticalAlertsData : criticalAlerts
  const visibleAlerts = alertSource.filter((alert) =>
    findingMatchesSearch(alert, normalizedSearchTerm)
  )
  const visibleLiveFeed = liveFeed.filter((item) => feedMatchesSearch(item, normalizedSearchTerm))
  const visibleSummary = hasActiveFilterContext
    ? {
        total_findings: filteredFindings.length,
        critical_alerts: filteredFindings.filter(
          (finding) => finding.severity === 'Critical' || finding.severity === 'High'
        ).length,
        reviewed_findings: filteredFindings.filter((finding) =>
          isResolvedStatus(finding.status)
        ).length,
        monitored_companies: new Set(filteredFindings.map((finding) => finding.company)).size,
        latest_collection: hasCompanyFocus
          ? `${companyFilter} filtered view`
          : hasActiveSearch
          ? `Search results for "${searchValue.trim()}"`
          : 'Filtered dashboard view',
      }
    : summary

  const visibleTimelineData = hasActiveFilterContext
    ? buildTimelineFromFindings(filteredFindings, dashboardData?.generated_at)
    : timelineData

  const severityData = (() => {
    const counts = ['Critical', 'High', 'Medium', 'Low', 'Info'].map((label) => {
      const serverValue = severityBreakdown.find((entry) => entry.label === label)?.value
      const localValue = filteredFindings.filter((finding) => finding.severity === label).length

      return {
        label,
        value: hasActiveFilterContext
          ? localValue
          : serverValue ?? localValue,
        color: severityTheme[label].chart,
      }
    })

    return counts.filter((entry) => entry.value > 0)
  })()

  const topCompanies =
    topCompaniesData.length > 0 && !hasActiveFilterContext
      ? topCompaniesData.map((company) => ({
          name: company.name,
          count: company.count,
          score: company.score,
          color: severityTheme[company.severity]?.chart ?? severityTheme.Info.chart,
        }))
      : [...filteredFindings]
          .sort((left, right) => right.riskScore - left.riskScore)
          .slice(0, 5)
          .map((finding) => ({
            name: finding.company,
            count: 1,
            score: finding.riskScore,
            color: severityTheme[finding.severity]?.chart ?? severityTheme.Info.chart,
          }))

  const statCards = [
    {
      icon: Activity,
      label: 'Total Findings',
      value: visibleSummary.total_findings,
      detail: visibleSummary.latest_collection || 'No scan data',
      accentClass: 'border-cyan-500/20',
      color: '#38bdf8',
      trend: [18, 24, 20, 30],
    },
    {
      icon: ShieldAlert,
      label: 'Critical Alerts',
      value: visibleSummary.critical_alerts,
      detail: 'Immediate review queue',
      accentClass: 'border-rose-500/20',
      color: '#fb7185',
      trend: [12, 18, 16, 28],
    },
    {
      icon: BadgeCheck,
      label: 'Reviewed',
      value: visibleSummary.reviewed_findings,
      detail: 'Analyzed records',
      accentClass: 'border-violet-500/20',
      color: '#a78bfa',
      trend: [10, 12, 18, 22],
    },
    {
      icon: Building2,
      label: 'Companies',
      value: visibleSummary.monitored_companies,
      detail: 'Currently monitored',
      accentClass: 'border-emerald-500/20',
      color: '#4ade80',
      trend: [14, 18, 20, 26],
    },
  ]

  const handleSelectItem = (itemId) => {
    setActiveItem(itemId)
    if (itemId === 'reports') {
      setIsReportOpen(true)
      return
    }
    const section = document.getElementById(itemId)
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  const handleSelectFinding = async (finding) => {
    setSelectedFindingId(finding.id)
    setSelectedFindingDetail({
      ...finding,
      title: finding.type,
      summary: 'Loading AI explanation...',
      recommendedAction: 'Preparing recommended response...',
      rawUrl: '',
      publishedAt: '',
      evidence: [],
    })
    setFindingDetailError('')
    setIsFindingDetailLoading(true)

    try {
      const detail = await getFindingDetail(finding.id)
      setSelectedFindingDetail(detail)
    } catch (error) {
      setFindingDetailError(error.message || 'Failed to load finding detail.')
    } finally {
      setIsFindingDetailLoading(false)
    }
  }

  const handleCloseFindingDetail = () => {
    setSelectedFindingId(null)
    setSelectedFindingDetail(null)
    setFindingDetailError('')
    setIsFindingDetailLoading(false)
    setIsUpdatingFindingStatus(false)
  }

  const handleUpdateFindingStatus = async (status) => {
    if (!selectedFindingId) return

    setIsUpdatingFindingStatus(true)
    setFindingDetailError('')

    try {
      const updatedFinding = await updateFindingStatus(selectedFindingId, status)
      setSelectedFindingDetail(updatedFinding)
      syncFindingAcrossDashboard(updatedFinding)
    } catch (error) {
      setFindingDetailError(error.message || 'Failed to update finding status.')
    } finally {
      setIsUpdatingFindingStatus(false)
    }
  }

  const generatedLabel = dashboardData?.generated_at
    ? new Date(dashboardData.generated_at).toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : summary.latest_collection || 'No scan data'

  const reportSummary = {
    totalFindings: visibleSummary.total_findings,
    criticalAlerts: visibleSummary.critical_alerts,
    reviewedFindings: visibleSummary.reviewed_findings,
    monitoredCompanies: visibleSummary.monitored_companies,
  }
  const reportSourceBreakdown = Object.values(
    filteredFindings.reduce((accumulator, finding) => {
      if (!accumulator[finding.source]) {
        accumulator[finding.source] = {
          label: finding.source,
          count: 0,
        }
      }
      accumulator[finding.source].count += 1
      return accumulator
    }, {})
  ).sort((left, right) => right.count - left.count)

  const focusedCompanyInsights = hasCompanyFocus
    ? {
        highestRisk: filteredFindings.reduce(
          (highest, finding) => Math.max(highest, finding.riskScore),
          0
        ),
        activeSources: new Set(filteredFindings.map((finding) => finding.source)).size,
        openFindings: filteredFindings.filter(
          (finding) => !isResolvedStatus(finding.status)
        ).length,
      }
    : null
  const reportContext = hasCompanyFocus
    ? {
        title: `${companyFilter} Exposure Report`,
        subtitle: `This report is focused on the currently filtered findings for ${companyFilter} and is suitable for a company-specific review or export.`,
      }
    : {
        title: 'Leak Detection Report',
        subtitle:
          'This report condenses the active findings queue, severity distribution, and company pressure trend from the current dashboard view into a printable analyst snapshot.',
      }

  const rightPanel = (
    <>
      <LiveMonitoringFeed items={visibleLiveFeed} searchValue={searchValue} />
      <SeverityLegend items={severityLegend} />
      <DataSourcesCard items={dataSources} />
      <DetectionEngineStatus
        modelStatus={detectionEngine.model_status}
        successRate={detectionEngine.success_rate}
      />
    </>
  )

  return (
    <DashboardShell
      activeItem={activeItem}
      onSearchChange={(value) => {
        setSearchValue(value)
        setCurrentPage(1)
      }}
      onSelectItem={handleSelectItem}
      rightPanel={rightPanel}
      searchValue={searchValue}
      sidebarStatusCards={sidebarStatusCards}
    >
      <section className="dashboard-fade flex items-center justify-between gap-3" id="dashboard">
        <div>
          <h1 className="section-title font-display text-[1.15rem] font-semibold tracking-tight text-white">
            Home
          </h1>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Real-time overview of detected leaks and exposures
          </p>
        </div>
        <div className="hidden rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1 text-[10px] text-slate-300 xl:block">
          {generatedLabel}
        </div>
      </section>

      {loadError ? (
        <StatusCard subtitle="API connection" title="Dashboard Data Unavailable">
          <p className="text-[11px] text-rose-300">
            {loadError}. Check the backend service and database connection.
          </p>
        </StatusCard>
      ) : null}

      {isLoading ? (
        <StatusCard subtitle="Loading" title="Syncing Dashboard">
          <p className="text-[11px] text-slate-400">
            Pulling live findings, metrics, and source activity from the backend.
          </p>
        </StatusCard>
      ) : null}

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4" id="summary">
        {statCards.map((card, index) => (
          <StatCard
            accentClass={card.accentClass}
            color={card.color}
            delay={`${index * 0.08}s`}
            detail={card.detail}
            icon={card.icon}
            key={card.label}
            label={card.label}
            trend={card.trend}
            value={card.value}
          />
        ))}
      </section>

      <LatestCriticalAlerts alerts={visibleAlerts} searchValue={searchValue} />

      <RecentFindings
        actions={
          <button
            className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] text-cyan-200 transition hover:border-cyan-400/40 hover:text-white"
            onClick={() => setIsReportOpen(true)}
            type="button"
          >
            Export Report
          </button>
        }
        companyFilter={companyFilter}
        companyOptions={companyOptions}
        currentPage={currentPage}
        findings={paginatedFindings}
        itemsPerPage={ITEMS_PER_PAGE}
        onCompanyFilterChange={(value) => {
          setCompanyFilter(value)
          setCurrentPage(1)
        }}
        onPageChange={handlePageChange}
        onSeverityFilterChange={(value) => {
          setSeverityFilter(value)
          setCurrentPage(1)
        }}
        onSortByChange={(value) => {
          setSortBy(value)
          setCurrentPage(1)
        }}
        onSelectFinding={handleSelectFinding}
        onStatusFilterChange={(value) => {
          setStatusFilter(value)
          setCurrentPage(1)
        }}
        severityFilter={severityFilter}
        sortBy={sortBy}
        statusFilter={statusFilter}
        totalResults={sortedFindings.length}
        totalPages={totalPages}
      />

      <section className="grid gap-3 xl:grid-cols-3" id="visualizations">
        <StatusCard
          subtitle="Distribution of findings by risk level."
          title="Findings by Severity"
        >
          <div className="grid gap-2 xl:grid-cols-[132px_1fr] xl:items-center">
            <SeverityDonutChart data={severityData} total={filteredFindings.length} />
            <div className="space-y-2">
              {severityData.map((item) => (
                <div className="flex items-center justify-between gap-3 text-[12px]" key={item.label}>
                  <span className="flex items-center gap-3 text-slate-300">
                    <span
                      className="signal-dot h-2 w-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </span>
                  <span className="text-slate-500">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </StatusCard>

        <StatusCard
          subtitle="Daily detection trend over the last seven days."
          title="Findings Over Time"
        >
          <FindingsLineChart data={visibleTimelineData} />
        </StatusCard>

        <StatusCard
          id="companies"
          subtitle="Companies with the highest current leak pressure."
          title="Top Affected Companies"
        >
          <CompaniesBarChart companies={topCompanies} />
        </StatusCard>
      </section>

      {isReportOpen ? (
        <ReportModal
          findings={sortedFindings}
          generatedAt={generatedLabel}
          onClose={() => setIsReportOpen(false)}
          onExport={() =>
            exportDashboardReport({
              findings: sortedFindings,
              summary: reportSummary,
              severityData,
              generatedAt: generatedLabel,
              context: reportContext,
            })
          }
          companyFocus={hasCompanyFocus}
          companyName={companyFilter}
          context={reportContext}
          focusedCompanyInsights={focusedCompanyInsights}
          sourceBreakdown={reportSourceBreakdown}
          timelineData={visibleTimelineData}
          topCompanies={topCompanies}
          severityData={severityData}
          summary={reportSummary}
        />
      ) : null}

      {selectedFindingId ? (
        <FindingDetailModal
          error={findingDetailError}
          finding={selectedFindingDetail}
          isLoading={isFindingDetailLoading}
          isUpdatingStatus={isUpdatingFindingStatus}
          onClose={handleCloseFindingDetail}
          onStatusChange={handleUpdateFindingStatus}
        />
      ) : null}
    </DashboardShell>
  )
}

export default Dashboard
