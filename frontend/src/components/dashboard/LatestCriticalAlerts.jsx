import { AlertOctagon } from 'lucide-react'
import StatusCard from '../cards/StatusCard'
import { getSeverityTheme } from '../../styles/theme'

function LatestCriticalAlerts({ alerts }) {
  return (
    <StatusCard
      actionLabel="View All Alerts"
      id="alerts"
      subtitle="Newest high-risk findings requiring immediate review."
      title="Latest Critical Alerts"
    >
      <div className="space-y-1.5">
        {alerts.map((alert) => {
          const theme = getSeverityTheme(alert.severity)

          return (
            <div
              className="data-row grid gap-1.5 rounded-[9px] border border-slate-800/80 bg-slate-950/45 px-2 py-1.5 xl:grid-cols-[minmax(0,1fr)_64px_84px] xl:items-center"
              key={alert.id}
            >
              <div className="flex min-w-0 items-start gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-rose-500/20 bg-rose-500/10 text-rose-300">
                  <AlertOctagon className="h-3.5 w-3.5" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-display text-[12px] font-semibold text-white">
                      {alert.company}
                    </p>
                    <span
                      className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium ${theme.badge}`}
                    >
                      {alert.type}
                    </span>
                  </div>

                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
                    <span>{alert.affected}</span>
                    <span>Source: {alert.source}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-950/80 px-1.5 py-1 text-center">
                <p className="font-display text-[0.95rem] font-semibold text-rose-200">
                  {alert.riskScore}
                </p>
                <p className="text-[8px] uppercase tracking-[0.14em] text-slate-500">
                  Risk Score
                </p>
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-950/80 px-2 py-1 text-right">
                <p className="text-[10px] text-slate-300">{alert.detectedAt}</p>
              </div>
            </div>
          )
        })}
      </div>
    </StatusCard>
  )
}

export default LatestCriticalAlerts
