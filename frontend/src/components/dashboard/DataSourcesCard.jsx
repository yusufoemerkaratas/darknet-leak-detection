import { Database } from "lucide-react";
import StatusCard from "../cards/StatusCard";

function DataSourcesCard({ items }) {
  return (
    <StatusCard
      id="data-sources-panel"
      subtitle="Connected sources"
      title="Data Sources"
    >
      {items.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-slate-800 bg-slate-950/35 px-3 py-3 text-[11px] text-slate-400">
          No data sources are connected in this workspace.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              className="data-row surface-subtle flex items-center justify-between gap-2 rounded-[12px] border border-slate-800/80 px-3 py-2"
              key={item.id}
            >
              <span
                className="flex min-w-0 items-center gap-2 text-[11px]"
                style={{ color: "var(--lg-text)" }}
              >
                <Database className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="surface-elevated rounded-lg border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </StatusCard>
  );
}

export default DataSourcesCard;
