import StatusCard from '../cards/StatusCard'
import { severityTheme } from '../../styles/theme'

function SeverityLegend({ items }) {
  return (
    <StatusCard id="severity-legend" subtitle="Score thresholds" title="Severity Legend">
      <div className="space-y-2">
        {items.map((item) => (
          <div className="flex items-center justify-between gap-3 text-[12px]" key={item.label}>
            <span className="flex items-center gap-2.5 text-slate-300">
              <span
                className="signal-dot h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    severityTheme[item.label]?.chart ?? severityTheme.Info.chart,
                }}
              />
              {item.label}
            </span>
            <span className="text-slate-500">{item.range}</span>
          </div>
        ))}
      </div>
    </StatusCard>
  )
}

export default SeverityLegend
