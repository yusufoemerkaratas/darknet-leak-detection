export function normalizeSeverityLabel(label, riskScore) {
  if (typeof riskScore === "number" && !Number.isNaN(riskScore)) {
    if (riskScore >= 90) return "Critical";
    if (riskScore >= 75) return "Medium";
    return "Low";
  }

  if (!label) return "Low";

  const normalized = String(label).toLowerCase();
  if (normalized === "critical") return "Critical";
  if (normalized === "high") return "Medium";
  if (normalized === "medium") return "Medium";
  if (normalized === "low") return "Low";
  if (normalized === "info" || normalized === "information") return "Low";
  return "Low";
}

export const severityTheme = {
  Critical: {
    badge:
      "border border-[var(--badge-critical-border)] bg-[var(--badge-critical-bg)] text-[var(--badge-critical-text)]",
    dot: "bg-[var(--badge-critical-dot)]",
    score:
      "border border-[var(--badge-critical-border)] bg-[var(--badge-critical-bg)] text-[var(--badge-critical-text)]",
    chart: "#ef4444",
  },
  High: {
    badge:
      "border border-[var(--badge-high-border)] bg-[var(--badge-high-bg)] text-[var(--badge-high-text)]",
    dot: "bg-[var(--badge-high-dot)]",
    score:
      "border border-[var(--badge-high-border)] bg-[var(--badge-high-bg)] text-[var(--badge-high-text)]",
    chart: "#f97316",
  },
  Medium: {
    badge:
      "border border-[var(--badge-medium-border)] bg-[var(--badge-medium-bg)] text-[var(--badge-medium-text)]",
    dot: "bg-[var(--badge-medium-dot)]",
    score:
      "border border-[var(--badge-medium-border)] bg-[var(--badge-medium-bg)] text-[var(--badge-medium-text)]",
    chart: "#f59e0b",
  },
  Low: {
    badge:
      "border border-[var(--badge-low-border)] bg-[var(--badge-low-bg)] text-[var(--badge-low-text)]",
    dot: "bg-[var(--badge-low-dot)]",
    score:
      "border border-[var(--badge-low-border)] bg-[var(--badge-low-bg)] text-[var(--badge-low-text)]",
    chart: "var(--badge-low-dot)",
  },
  Info: {
    badge:
      "border border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-text)]",
    dot: "bg-[var(--badge-info-dot)]",
    score:
      "border border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-text)]",
    chart: "#38bdf8",
  },
};

export const statusTheme = {
  "Not Reviewed":
    "border border-[var(--status-not-reviewed-border)] bg-[var(--status-not-reviewed-bg)] text-[var(--status-not-reviewed-text)]",
  Reviewed:
    "border border-[var(--status-reviewed-border)] bg-[var(--status-reviewed-bg)] text-[var(--status-reviewed-text)]",
  "False Positive":
    "border border-[var(--status-false-positive-border)] bg-[var(--status-false-positive-bg)] text-[var(--status-false-positive-text)]",
  Escalated:
    "border border-[var(--status-escalated-border)] bg-[var(--status-escalated-bg)] text-[var(--status-escalated-text)]",
};

export function getSeverityTheme(severity) {
  return severityTheme[normalizeSeverityLabel(severity)] ?? severityTheme.Low;
}

export function getStatusTheme(status) {
  return (
    statusTheme[status] ??
    "border border-slate-700 bg-slate-800/70 text-slate-200"
  );
}

export const theme = {
  bg: "#0f1418",
  surface: "#151c21",
  card: "#11181d",
  text: "#d9e2ea",
  muted: "#8c99a8",
  accent: "#6ea8d7",
  accentMuted: "#5f95c0",
  success: "#5da987",
  warning: "#d0a05a",
  danger: "#d46d6d",
  glass: "rgba(255,255,255,0.02)",
};
