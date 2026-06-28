import StatusCard from "../cards/StatusCard";
import { severityTheme } from "../../styles/theme";

const LEGEND_ITEMS = [
  { label: "Critical", range: "90 - 100" },
  { label: "Medium", range: "75 - 89" },
  { label: "Low", range: "0 - 74" },
];

function SeverityLegend() {
  return (
    <StatusCard
      id="severity-legend"
      subtitle="Score thresholds"
      title="Severity Legend"
    >
      <div className="space-y-2">
        {LEGEND_ITEMS.map((item) => (
          <div
            className="flex items-center justify-between gap-3 text-[11px]"
            key={item.label}
          >
            <span className="flex items-center gap-2.5" style={{ color: "var(--lg-text)" }}>
              <span
                className="signal-dot h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    severityTheme[item.label]?.chart ?? severityTheme.Low.chart,
                }}
              />
              {item.label}
            </span>
            <span style={{ color: "var(--lg-muted)" }}>{item.range}</span>
          </div>
        ))}
      </div>
    </StatusCard>
  );
}

export default SeverityLegend;
