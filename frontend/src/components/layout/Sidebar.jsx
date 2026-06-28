import {
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  Database,
  FileText,
  LayoutDashboard,
  SearchCheck,
  Shield,
  X,
} from "lucide-react";
import { navigationItems, rightPanelItems } from "../../data/mockData";

const iconMap = {
  dashboard: LayoutDashboard,
  alerts: Bell,
  findings: SearchCheck,
  companies: Building2,
  "top-companies-panel": Building2,
  sources: Database,
  visualizations: BarChart3,
  reports: FileText,
  "severity-legend": BarChart3,
  "data-sources-panel": Database,
};

function Sidebar({ activeItem, detectionEngine, isOpen, onClose, onSelectItem }) {
  const coverage = Math.max(
    0,
    Math.min(100, Number(detectionEngine?.analysis_coverage ?? 0)),
  );
  const modelStatus = detectionEngine?.model_status ?? "Unknown";

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition xl:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-3 left-3 z-40 flex w-[204px] flex-col rounded-[16px] px-3.5 py-3.5 transition duration-300 xl:inset-y-4 xl:left-4 xl:w-[204px] ${
          isOpen ? "translate-x-0" : "-translate-x-[120%] xl:translate-x-0"
        }`}
        style={{
          backgroundColor: "var(--lg-card, #12191e)",
          borderRight: "1px solid rgba(255,255,255,0.03)",
        }}
      >
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl soft-ring"
              style={{
                background:
                  "linear-gradient(135deg, rgba(110,168,215,0.08), rgba(124,152,179,0.05))",
              }}
            >
              <Shield
                className="h-5 w-5"
                style={{ color: "var(--lg-accent, #38bdf8)" }}
              />
            </div>

            <div>
              <p
                className="font-display text-[1.22rem] font-semibold tracking-tight"
                style={{ color: "var(--lg-text, #d9e2ea)" }}
              >
                LeakGuard
              </p>
              <p
                className="max-w-[150px] text-[9px] leading-4"
                style={{ color: "var(--lg-muted, #8d9aa8)" }}
              >
                AI-based leak detection system
              </p>
            </div>
          </div>

          <button
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-slate-400 xl:hidden"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-0.5">
          {navigationItems.map((item) => {
            const Icon = iconMap[item.id];
            const isActive = activeItem === item.id;

            return (
              <button
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition ${
                  isActive
                    ? "shadow-[0_0_22px_rgba(110,168,215,0.1)]"
                    : ""
                }`}
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                type="button"
                style={{
                  color: isActive ? "var(--lg-text)" : "var(--lg-muted)",
                  backgroundColor: isActive
                    ? "var(--lg-sidebar-active-bg)"
                    : "transparent",
                }}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[12px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-4 border-t border-slate-800/80 pt-3">
          <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Right Panel
          </p>
          <div className="space-y-0.5">
            {rightPanelItems.map((item) => {
              const Icon = iconMap[item.id];
              const isActive = activeItem === item.id;

              return (
                <button
                  className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                    isActive
                      ? "shadow-[0_0_18px_rgba(110,168,215,0.08)]"
                      : ""
                  }`}
                  key={item.id}
                  onClick={() => onSelectItem(item.id)}
                  type="button"
                  style={{
                    color: isActive ? "var(--lg-text)" : "var(--lg-muted)",
                    backgroundColor: isActive
                      ? "var(--lg-sidebar-active-bg)"
                      : "transparent",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium">
                      {item.label}
                    </span>
                  </span>
                  <ArrowRight
                    className={`h-3 w-3 transition ${
                      isActive ? "translate-x-0" : "group-hover:translate-x-0.5"
                    }`}
                    style={{
                      color: isActive
                        ? "var(--lg-accent, #38bdf8)"
                        : "rgba(148,163,184,0.6)",
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-auto border-t border-slate-800/80 px-3 pb-1 pt-3">
          <div className="flex items-center justify-between gap-2">
            <p
              className="text-[10px] font-medium"
              style={{ color: "var(--lg-muted)" }}
            >
              Engine status
            </p>
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
              style={{
                color: "var(--lg-text)",
                background: "var(--lg-control-bg)",
                border: "1px solid var(--lg-control-border)",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "var(--lg-success)" }}
              />
              {modelStatus}
            </span>
          </div>

          <div className="mt-2">
            <div
              className="mb-1 flex items-center justify-between gap-2 text-[10px]"
              style={{ color: "var(--lg-muted)" }}
            >
              <span>Coverage</span>
              <span style={{ color: "var(--lg-text)" }}>{coverage.toFixed(1)}%</span>
            </div>
            <div
              className="h-1 rounded-full"
              style={{ background: "var(--lg-control-border)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${coverage}%`,
                  background: "var(--lg-accent-muted)",
                }}
              />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
