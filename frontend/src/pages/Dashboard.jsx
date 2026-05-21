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
import LatestCriticalAlerts from '../components/dashboard/LatestCriticalAlerts'
import LiveMonitoringFeed from '../components/dashboard/LiveMonitoringFeed'
import RecentFindings from '../components/dashboard/RecentFindings'
import SeverityLegend from '../components/dashboard/SeverityLegend'
import StatusCard from '../components/cards/StatusCard'
import DashboardShell from '../components/layout/DashboardShell'
import { getDashboardOverview } from '../api/client'
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
  const normalizedSearchTerm = normalizeSearchTerm(searchValue)
  const hasActiveSearch = normalizedSearchTerm.length > 0
  const searchMatchedFindings = findings.filter((finding) =>
    findingMatchesSearch(finding, normalizedSearchTerm)
  )

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
  const visibleSummary = hasActiveSearch
    ? {
        total_findings: searchMatchedFindings.length,
        critical_alerts: searchMatchedFindings.filter(
          (finding) => finding.severity === 'Critical' || finding.severity === 'High'
        ).length,
        reviewed_findings: searchMatchedFindings.filter(
          (finding) => finding.status === 'Reviewed'
        ).length,
        monitored_companies: new Set(searchMatchedFindings.map((finding) => finding.company)).size,
        latest_collection: `Search results for "${searchValue.trim()}"`,
      }
    : summary

  const severityData = (() => {
    const counts = ['Critical', 'High', 'Medium', 'Low', 'Info'].map((label) => {
      const serverValue = severityBreakdown.find((entry) => entry.label === label)?.value
      const localValue = filteredFindings.filter((finding) => finding.severity === label).length

      return {
        label,
        value: hasActiveSearch || companyFilter !== 'All Companies' || severityFilter !== 'All Severity' || statusFilter !== 'All Status'
          ? localValue
          : serverValue ?? localValue,
        color: severityTheme[label].chart,
      }
    })

    return counts.filter((entry) => entry.value > 0)
  })()

  const topCompanies =
    topCompaniesData.length > 0 && !hasActiveSearch
      ? topCompaniesData.map((company) => ({
          name: company.name,
          count: company.count,
          score: company.score,
          color: severityTheme[company.severity]?.chart ?? severityTheme.Info.chart,
        }))
      : [...(hasActiveSearch ? searchMatchedFindings : findings)]
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
    const section = document.getElementById(itemId)
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return
    setCurrentPage(page)
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
            Dashboard
          </h1>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Real-time overview of detected leaks and exposures
          </p>
        </div>
        <div className="hidden rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1 text-[10px] text-slate-300 xl:block">
          {dashboardData?.generated_at
            ? new Date(dashboardData.generated_at).toLocaleString('en-GB', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
            : summary.latest_collection || 'No scan data'}
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
          <FindingsLineChart data={timelineData} />
        </StatusCard>

        <StatusCard
          id="companies"
          subtitle="Companies with the highest current leak pressure."
          title="Top Affected Companies"
        >
          <CompaniesBarChart companies={topCompanies} />
        </StatusCard>
      </section>
    </DashboardShell>
  )
}

export default Dashboard
