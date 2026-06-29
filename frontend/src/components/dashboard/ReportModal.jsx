import { useState } from "react";
import { AlertTriangle, Download, ShieldCheck, Users, X } from "lucide-react";
import FindingsLineChart from "../charts/FindingsLineChart";
import SeverityDonutChart from "../charts/SeverityDonutChart";
import CompaniesBarChart from "../charts/CompaniesBarChart";
import TimelineRangeSelector from "./TimelineRangeSelector";

const FINDINGS_PAGE_SIZE = 6;

function ReportModal({
  findings,
  severityData,
  summary,
  generatedAt,
  context,
  companyFocus,
  companyName,
  focusedCompanyInsights,
  sourceBreakdown,
  timelineData,
  timelineRange,
  topCompanies,
  onTimelineRangeChange,
  onClose,
  onExport,
}) {
  const [findingsPage, setFindingsPage] = useState(1);
  const findingsTotalPages = Math.max(
    1,
    Math.ceil(findings.length / FINDINGS_PAGE_SIZE),
  );
  const findingsStartIndex = (findingsPage - 1) * FINDINGS_PAGE_SIZE;
  const visibleFindings = findings.slice(
    findingsStartIndex,
    findingsStartIndex + FINDINGS_PAGE_SIZE,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="panel-surface max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-[20px] border border-slate-800/90 p-4 sm:p-5"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Reports
            </p>
            <h2 className="mt-1 font-display text-[1.3rem] font-semibold text-white">
              {context.title}
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              Generated {generatedAt}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="btn-secondary rounded-lg px-3 py-2 text-[11px]"
              onClick={onExport}
              type="button"
            >
              <span className="inline-flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Print / Save PDF
              </span>
            </button>
            <button
              className="btn-secondary rounded-lg p-2 text-slate-300"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[18px] border border-slate-800/90 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,rgba(8,15,36,0.98),rgba(5,10,24,0.96))] p-4">
          <div className="absolute -right-10 top-0 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-12 h-24 w-24 rounded-full bg-rose-400/10 blur-3xl" />
          <div className="relative grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
                Analyst Summary
              </p>
              <h3 className="mt-2 font-display text-[1.5rem] font-semibold leading-tight text-white">
                {companyFocus
                  ? `${companyName} leak exposure snapshot`
                  : "Current leak exposure snapshot across monitored companies"}
              </h3>
              <p className="mt-2 max-w-xl text-[12px] leading-6 text-slate-300">
                {context.subtitle}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/45 px-3 py-2.5">
                <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />
                  Critical Pressure
                </p>
                <p className="mt-1 text-[1.15rem] font-semibold text-white">
                  {summary.criticalAlerts} high-priority alerts
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/45 px-3 py-2.5">
                <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                  Review Coverage
                </p>
                <p className="mt-1 text-[1.15rem] font-semibold text-white">
                  {summary.reviewedFindings} reviewed items
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/45 px-3 py-2.5">
                <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  Scope
                </p>
                <p className="mt-1 text-[1.15rem] font-semibold text-white">
                  {companyFocus
                    ? `${summary.totalFindings} findings for ${companyName}`
                    : `${summary.totalFindings} findings across ${summary.monitoredCompanies} companies`}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[0.88fr_1.12fr]">
          <div className="rounded-[18px] border border-slate-800 bg-slate-950/45 p-3.5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              Severity Distribution
            </p>
            <div className="mt-2 grid gap-2 xl:grid-cols-[160px_1fr] xl:items-center">
              <SeverityDonutChart
                data={severityData}
                total={summary.totalFindings}
              />
              <div className="space-y-2">
                {severityData.map((item) => (
                  <div
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-2.5 py-2 text-[11px]"
                    key={item.label}
                  >
                    <span className="text-slate-300">{item.label}</span>
                    <span className="text-slate-100">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[18px] border border-slate-800 bg-slate-950/45 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Findings Over Time
              </p>
              <TimelineRangeSelector
                onChange={onTimelineRangeChange}
                value={timelineRange}
              />
            </div>
            <div className="mt-2">
              <FindingsLineChart data={timelineData} />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[18px] border border-slate-800 bg-slate-950/45 p-3.5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {companyFocus ? "Company Focus" : "Top Affected Companies"}
            </p>
            {companyFocus ? (
              <div className="mt-3 grid gap-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    Highest Risk Score
                  </p>
                  <p className="mt-1 text-[1.15rem] font-semibold text-white">
                    {focusedCompanyInsights?.highestRisk ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    Active Sources
                  </p>
                  <p className="mt-1 text-[1.15rem] font-semibold text-white">
                    {focusedCompanyInsights?.activeSources ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    Open Findings
                  </p>
                  <p className="mt-1 text-[1.15rem] font-semibold text-white">
                    {focusedCompanyInsights?.openFindings ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    Source Breakdown
                  </p>
                  {sourceBreakdown.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {sourceBreakdown.map((item) => (
                        <div
                          className="flex items-center justify-between text-[11px]"
                          key={item.label}
                        >
                          <span className="text-slate-300">{item.label}</span>
                          <span className="text-slate-100">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-400">
                      No source data in the current filtered view.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <CompaniesBarChart companies={topCompanies} />
              </div>
            )}
          </div>

          <div className="rounded-[18px] border border-slate-800 bg-slate-950/45 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Included Findings
              </p>
              <p className="text-[10px] text-slate-500">
                {findings.length === 0
                  ? "0 results"
                  : `${findingsStartIndex + 1}-${Math.min(findingsStartIndex + visibleFindings.length, findings.length)} of ${findings.length}`}
              </p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {visibleFindings.map((finding) => (
                <div
                  className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2"
                  key={finding.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-white">
                        {finding.company}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {finding.type}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {finding.detectedAt}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-300">
                    {finding.status} • Score {finding.riskScore}
                  </p>
                </div>
              ))}
            </div>
            {findingsTotalPages > 1 ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  className="btn-secondary rounded-md px-2.5 py-1 text-[11px] text-slate-300 disabled:opacity-40"
                  disabled={findingsPage === 1}
                  onClick={() =>
                    setFindingsPage((current) => Math.max(1, current - 1))
                  }
                  type="button"
                >
                  Previous
                </button>
                <span className="text-[11px] text-slate-500">
                  Page {findingsPage} / {findingsTotalPages}
                </span>
                <button
                  className="btn-secondary rounded-md px-2.5 py-1 text-[11px] text-slate-300 disabled:opacity-40"
                  disabled={findingsPage === findingsTotalPages}
                  onClick={() =>
                    setFindingsPage((current) =>
                      Math.min(findingsTotalPages, current + 1),
                    )
                  }
                  type="button"
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportModal;
