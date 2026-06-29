import { Database, X } from "lucide-react";
import SourceManagementPanel from "./SourceManagementPanel";

function SourceManagementModal({ onClose }) {
  const closeButtonStyle = {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderColor: "rgba(129, 145, 161, 0.22)",
    color: "var(--lg-text)",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/72 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="panel-surface max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-[20px] border border-slate-800/90 p-4 sm:p-5"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Sources
            </p>
            <h2 className="mt-1 flex items-center gap-2 font-display text-[1.15rem] font-semibold text-white">
              <Database className="h-4 w-4 text-cyan-300" />
              Source Management
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              Manage collector endpoints without crowding the main dashboard
              view.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-slate-800 bg-slate-950/70 p-2 text-slate-300 transition hover:text-white"
              onClick={onClose}
              style={closeButtonStyle}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <SourceManagementPanel />
      </div>
    </div>
  );
}

export default SourceManagementModal;
