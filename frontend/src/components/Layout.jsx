import { useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const findings = [
  {
    company: 'TechNova GmbH',
    classification: 'Credential Leak',
    severity: 'Critical',
    score: 92,
    status: 'Open',
    timestamp: '2026-05-04 10:15',
  },
  {
    company: 'DataCore AG',
    classification: 'Email Exposure',
    severity: 'Medium',
    score: 76,
    status: 'Reviewing',
    timestamp: '2026-05-03 18:40',
  },
  {
    company: 'CloudBridge SE',
    classification: 'Password Dump',
    severity: 'Critical',
    score: 88,
    status: 'Open',
    timestamp: '2026-05-03 12:05',
  },
  {
    company: 'SecureLine GmbH',
    classification: 'False Positive',
    severity: 'Low',
    score: 34,
    status: 'Reviewed',
    timestamp: '2026-05-02 09:20',
  },
]

function Layout() {
  const [companyFilter, setCompanyFilter] = useState('All Companies')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [severityFilter, setSeverityFilter] = useState('All Severity')
  const [showReport, setShowReport] = useState(false)
  const [sortBy, setSortBy] = useState('score-desc')

  const filteredFindings = findings.filter((finding) => {
    const companyMatch =
      companyFilter === 'All Companies' || finding.company === companyFilter

    const statusMatch =
      statusFilter === 'All Status' || finding.status === statusFilter

    const severityMatch =
      severityFilter === 'All Severity' || finding.severity === severityFilter

    return companyMatch && statusMatch && severityMatch
  })

  const severityData = [
    {
      severity: 'Critical',
      count: filteredFindings.filter((finding) => finding.severity === 'Critical').length,
    },
    {
      severity: 'Medium',
      count: filteredFindings.filter((finding) => finding.severity === 'Medium').length,
    },
    {
      severity: 'Low',
      count: filteredFindings.filter((finding) => finding.severity === 'Low').length,
    },
  ]

  const sortedFindings = [...filteredFindings].sort((a, b) => {
    if (sortBy === 'score-desc') return b.score - a.score
    if (sortBy === 'score-asc') return a.score - b.score
    if (sortBy === 'newest') return new Date(b.timestamp) - new Date(a.timestamp)
    if (sortBy === 'oldest') return new Date(a.timestamp) - new Date(b.timestamp)
    return 0
  })
  const latestCriticalAlerts = sortedFindings
  .filter((finding) => finding.severity === 'Critical')
 .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
.slice(0, 3)

  return (
    <div>
      <Header />

      <div className="layout-body">
        <Sidebar />

        <main id="dashboard" className="dashboard-main">
          <section className="hero-section">
            <div>
              <p className="eyebrow">AI-Powered Leak Detection System</p>
              <h1 className="page-title">Dashboard Home</h1>
              <p className="page-subtitle">
                Monitor detected data leaks, review critical alerts and track company exposure.
              </p>
            </div>
          </section>

          <div className="stats-grid">
            <div className="stat-card">
              <p>Total Findings</p>
              <h2>120</h2>
              <span>+18 this week</span>
            </div>

            <div className="stat-card critical-card">
              <p>Critical Alerts</p>
              <h2>15</h2>
              <span>Requires review</span>
            </div>

            <div className="stat-card">
              <p>Reviewed</p>
              <h2>80</h2>
              <span>66% completed</span>
            </div>

            <div className="stat-card">
              <p>Companies</p>
              <h2>5</h2>
              <span>Currently monitored</span>
            </div>
          </div>

          <section className="insights-grid">
            <div className="insight-card">
              <h3>Risk Overview</h3>
              <div className="risk-bars">
                <div>
                  <span>Critical</span>
                  <div className="bar">
                    <div className="bar-fill critical-fill"></div>
                  </div>
                </div>

                <div>
                  <span>Medium</span>
                  <div className="bar">
                    <div className="bar-fill medium-fill"></div>
                  </div>
                </div>

                <div>
                  <span>Low</span>
                  <div className="bar">
                    <div className="bar-fill low-fill"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="insight-card">
              <h3>System Status</h3>
  
              <p className="system-text">
                Darknet monitoring active. Latest scan completed successfully.
              </p>
              <span className="live-badge">● Live Monitoring</span>
            </div>
<div id="alerts" className="insight-card latest-alerts-card">
    <div className="alerts-header">
      <div>
        <h3>Latest Critical Alerts</h3>
        <p>Newest high-risk findings requiring immediate review.</p>
      </div>
      <span className="alert-count">{latestCriticalAlerts.length}</span>
    </div>

    <div className="alerts-list">
      {latestCriticalAlerts.map((alert) => (
        <div className="alert-item" key={`${alert.company}-${alert.timestamp}`}>
          <div>
            <strong>{alert.company}</strong>
            <p>{alert.classification}</p>
          </div>

          <div className="alert-meta">
            <span className="score-pill">{alert.score}</span>
            <small>{alert.timestamp}</small>
          </div>
        </div>
      ))}
    </div>
  </div>



          </section>

          <section id="findings" className="findings-section">
            <div className="section-header">
              <div>
                <h1 className="page-title">Findings</h1>
                <p className="page-subtitle">
                  Detected data leak findings from monitored companies.
                </p>
              </div>

              <button
  className="export-button"
  onClick={() => setShowReport(true)}
>
  Export Report
</button>
            </div>

            <div className="filters">
              <select
                className="filter-select"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
              >
                <option>All Companies</option>
                <option>TechNova GmbH</option>
                <option>DataCore AG</option>
                <option>CloudBridge SE</option>
                <option>SecureLine GmbH</option>
              </select>

              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>All Status</option>
                <option>Open</option>
                <option>Reviewing</option>
                <option>Reviewed</option>
              </select>

              <select
                className="filter-select"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option>All Severity</option>
                <option>Critical</option>
                <option>Medium</option>
                <option>Low</option>
              </select>

              <select
                className="filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="score-desc">Score: High to Low</option>
                <option value="score-asc">Score: Low to High</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            <div className="table-card">
              <table className="findings-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Classification</th>
                    <th>Severity</th>
                    <th>Score</th>
                    <th>Review Status</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>

                <tbody>
                  {sortedFindings.map((finding) => (
                    <tr key={`${finding.company}-${finding.timestamp}`}>
                      <td>{finding.company}</td>
                      <td>{finding.classification}</td>
                      <td>
                        <span className={`severity ${finding.severity.toLowerCase()}`}>
                          {finding.severity}
                        </span>
                      </td>
                      <td
                        className={
                          finding.score >= 85
                            ? 'score-high'
                            : finding.score >= 60
                            ? 'score-medium'
                            : 'score-low'
                        }
                      >
                        {finding.score}
                      </td>
                      <td>
                        <span className={`status ${finding.status.toLowerCase()}`}>
                          {finding.status}
                        </span>
                      </td>
                      <td>{finding.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="visualizations" className="visualizations-section">
            <div className="section-header">
              <div>
                <h1 className="page-title">Visualizations</h1>
                <p className="page-subtitle">
                  Severity distribution based on the selected filters.
                </p>
              </div>
            </div>

            <div className="charts-grid">
              <div className="chart-card">
                <h3>Severity Bar Chart</h3>

                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={severityData}>
                      <XAxis dataKey="severity" stroke="#d8d4ff" />
                      <YAxis stroke="#d8d4ff" />
                      <Tooltip />
                      <Bar dataKey="count" fill="#ff4db8" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="chart-card">
                <h3>Severity Pie Chart</h3>

                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={severityData}
                        dataKey="count"
                        nameKey="severity"
                        outerRadius={95}
                      >
                        <Cell fill="#ff4db8" />
                        <Cell fill="#ffd166" />
                        <Cell fill="#7cf7c2" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

{showReport && (
  <div className="report-modal">
    <div className="report-content">
      <h2>Leak Detection Report</h2>

      <p>Total Findings: {filteredFindings.length}</p>

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={severityData}>
            <XAxis dataKey="severity" />
            <YAxis />
            <Bar dataKey="count" fill="#ff4db8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={severityData} dataKey="count">
              <Cell fill="#ff4db8" />
              <Cell fill="#ffd166" />
              <Cell fill="#7cf7c2" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <button onClick={() => setShowReport(false)}>
        Close
      </button>
    </div>
  </div>
)}

        </main>
      </div>
    </div>
  )
}

export default Layout