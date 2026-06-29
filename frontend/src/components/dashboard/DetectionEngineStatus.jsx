import DetectionGaugeChart from "../charts/DetectionGaugeChart";
import StatusCard from "../cards/StatusCard";

function DetectionEngineStatus({
  modelStatus,
  analysisCoverage,
  analyzedFindings,
  pendingFindings,
}) {
  return (
    <StatusCard
      id="engine-status-panel"
      subtitle="Pipeline status"
      title="Detection Engine Status"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-[12px] border border-slate-800/80 bg-slate-950/45 px-3 py-2 text-[12px]">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="signal-dot h-2 w-2 rounded-full bg-[var(--lg-accent)]" />
            Model Status
          </span>
          <span className="text-slate-200">{modelStatus}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[12px] border border-slate-800/80 bg-slate-950/45 px-3 py-2 text-[12px]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Analyzed
            </p>
            <p className="mt-1 text-slate-100">{analyzedFindings}</p>
          </div>
          <div className="rounded-[12px] border border-slate-800/80 bg-slate-950/45 px-3 py-2 text-[12px]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Pending
            </p>
            <p className="mt-1 text-slate-100">{pendingFindings}</p>
          </div>
        </div>

        <DetectionGaugeChart label="Coverage" value={analysisCoverage} />
      </div>
    </StatusCard>
  );
}

export default DetectionEngineStatus;
