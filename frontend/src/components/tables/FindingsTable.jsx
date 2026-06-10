import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getSeverityTheme, getStatusTheme } from '../../styles/theme'

function FindingsTable({
  findings,
  companyFilter,
  onCompanyFilterChange,
  severityFilter,
  onSeverityFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
  companyOptions,
  currentPage,
  itemsPerPage,
  totalResults,
  totalPages,
  onPageChange,
  onSelectFinding,
}) {
  const filterClassName =
    'rounded-lg border border-slate-800 bg-[#050913] px-2.5 py-1.5 text-[11px] text-slate-300 outline-none appearance-none'

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-1.5 sm:flex-row">
          <select
            className={filterClassName}
            onChange={(event) => onCompanyFilterChange(event.target.value)}
            value={companyFilter}
          >
            <option value="All Companies">All Companies</option>
            {companyOptions.map((company) => (
              <option key={company} value={company}>
                {company}
              </option>
            ))}
          </select>

          <select
            className={filterClassName}
            onChange={(event) => onSeverityFilterChange(event.target.value)}
            value={severityFilter}
          >
            <option value="All Severity">All Severity</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            className={filterClassName}
            onChange={(event) => onStatusFilterChange(event.target.value)}
            value={statusFilter}
          >
            <option value="All Status">All Status</option>
            <option value="Not Reviewed">Not Reviewed</option>
            <option value="Reviewed">Reviewed</option>
            <option value="False Positive">False Positive</option>
            <option value="Escalated">Escalated</option>
          </select>
        </div>

        <select
          className={filterClassName}
          onChange={(event) => onSortByChange(event.target.value)}
          value={sortBy}
        >
          <option value="score-desc">Risk Score High</option>
          <option value="score-asc">Risk Score Low</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-[11px] border border-slate-800/80 bg-[#040913]">
        <table className="min-w-full divide-y divide-slate-800 text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Severity</th>
              <th className="px-3 py-2 font-medium">Risk Score</th>
              <th className="px-3 py-2 font-medium">Detected At</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/90">
            {findings.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-[11px] text-slate-400" colSpan="6">
                  No findings matched the current search and filters.
                </td>
              </tr>
            ) : null}

            {findings.map((finding) => {
              const severityTone = getSeverityTheme(finding.severity)
              const statusTone = getStatusTheme(finding.status)

              return (
                <tr
                  className={`data-row ${onSelectFinding ? 'cursor-pointer' : ''}`}
                  key={finding.id}
                  onClick={onSelectFinding ? () => onSelectFinding(finding) : undefined}
                >
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-[11px] text-slate-100">{finding.company}</div>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-300">{finding.type}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${severityTone.badge}`}
                    >
                      {finding.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex min-w-10 justify-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${severityTone.score}`}
                    >
                      {finding.riskScore}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[10px] text-slate-400">{finding.detectedAt}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusTone}`}
                    >
                      {finding.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {findings.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{' '}
          {(currentPage - 1) * itemsPerPage + findings.length} of {totalResults} results
        </p>

        <div className="flex items-center gap-2">
          <button
            className="rounded-md border border-slate-800 bg-slate-950/80 p-1.5 text-slate-300 disabled:opacity-40"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="rounded-md border border-slate-700 bg-[#060b18] px-2.5 py-1 text-slate-200">
            {currentPage}
          </span>
          <button
            className="rounded-md border border-slate-800 bg-slate-950/80 p-1.5 text-slate-300 disabled:opacity-40"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => onPageChange(currentPage + 1)}
            type="button"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default FindingsTable
