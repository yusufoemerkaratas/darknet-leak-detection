import DetectionGaugeChart from '../charts/DetectionGaugeChart'
import StatusCard from '../cards/StatusCard'

function DetectionEngineStatus({ modelStatus, successRate }) {
  return (
    <StatusCard
      id="engine-status-panel"
      subtitle="Pipeline status"
      title="Detection Engine Status"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-[12px] border border-slate-800/80 bg-slate-950/45 px-3 py-2 text-[12px]">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="signal-dot h-2 w-2 rounded-full bg-emerald-400" />
            AI Model
          </span>
          <span className="text-emerald-300">{modelStatus}</span>
        </div>

        <DetectionGaugeChart value={successRate} />
      </div>
    </StatusCard>
  )
}

export default DetectionEngineStatus
