import argparse
import os
from pathlib import Path
from typing import Dict, List, Set

import yaml

from analysis.detectors.credential_detector import CredentialDetector

ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DATASET_DIR = ROOT_DIR / "docs" / "analysis" / "test_dataset"
PATTERN_CONFIG_PATH = ROOT_DIR / "analysis" / "config" / "patterns.yaml"
REPORT_PATH = ROOT_DIR / "docs" / "analysis" / "pattern-testing.md"

AUTO_START = "<!-- AUTO-GENERATED:START -->"
AUTO_END = "<!-- AUTO-GENERATED:END -->"


def _load_pattern_types() -> List[str]:
    with open(PATTERN_CONFIG_PATH, "r", encoding="utf-8") as fh:
        config = yaml.safe_load(fh) or {}

    return [p.get("pattern_type") for p in config.get("patterns", []) if p.get("pattern_type")]


def _load_labels(label_path: Path) -> Set[str]:
    if not label_path.exists():
        return set()

    with open(label_path, "r", encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}

    if isinstance(data, dict):
        patterns = data.get("patterns") or data.get("labels") or []
    else:
        patterns = data or []

    return {str(p).strip() for p in patterns if str(p).strip()}


def _collect_samples(dataset_dir: Path) -> List[Path]:
    if not dataset_dir.exists():
        return []

    return sorted(dataset_dir.glob("*.txt"))


def _compute_metrics(samples: List[Path], pattern_types: List[str]) -> Dict[str, Dict[str, int]]:
    detector = CredentialDetector(str(PATTERN_CONFIG_PATH))
    metrics = {
        pattern: {"samples": 0, "tp": 0, "fp": 0, "fn": 0}
        for pattern in pattern_types
    }

    for text_path in samples:
        text = text_path.read_text(encoding="utf-8", errors="ignore")
        predicted = {r.pattern_type for r in detector.detect(text)}
        labels = _load_labels(text_path.with_suffix(".yaml"))

        for pattern in pattern_types:
            if pattern in labels:
                metrics[pattern]["samples"] += 1

            if pattern in labels and pattern in predicted:
                metrics[pattern]["tp"] += 1
            elif pattern not in labels and pattern in predicted:
                metrics[pattern]["fp"] += 1
            elif pattern in labels and pattern not in predicted:
                metrics[pattern]["fn"] += 1

    return metrics


def _format_metric(value: float) -> str:
    return f"{value:.2f}"


def _render_table(metrics: Dict[str, Dict[str, int]]) -> str:
    lines = []
    lines.append("| Pattern Type | Samples | TP | FP | FN | Precision | Recall | Status |")
    lines.append("|---|---|---|---|---|---|---|---|")

    any_samples = any(m["samples"] > 0 for m in metrics.values())

    for pattern, m in metrics.items():
        tp = m["tp"]
        fp = m["fp"]
        fn = m["fn"]
        samples = m["samples"]

        if tp + fp > 0:
            precision = _format_metric(tp / (tp + fp))
        else:
            precision = "—"

        if tp + fn > 0:
            recall = _format_metric(tp / (tp + fn))
        else:
            recall = "—"

        status = "Computed" if any_samples else "No data"

        lines.append(
            f"| {pattern} | {samples} | {tp} | {fp} | {fn} | {precision} | {recall} | {status} |"
        )

    return "\n".join(lines)


def _update_report(report_path: Path, content: str) -> None:
    if not report_path.exists():
        report_path.write_text(content, encoding="utf-8")
        return

    existing = report_path.read_text(encoding="utf-8")

    if AUTO_START in existing and AUTO_END in existing:
        before, rest = existing.split(AUTO_START, 1)
        _, after = rest.split(AUTO_END, 1)
        report_path.write_text(
            before + AUTO_START + "\n" + content + "\n" + AUTO_END + after,
            encoding="utf-8",
        )
        return

    report_path.write_text(
        existing.rstrip() + "\n\n" + AUTO_START + "\n" + content + "\n" + AUTO_END + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dataset",
        default=str(DEFAULT_DATASET_DIR),
        help="Path to labeled test dataset directory",
    )
    args = parser.parse_args()

    dataset_dir = Path(args.dataset)
    pattern_types = _load_pattern_types()
    samples = _collect_samples(dataset_dir)
    metrics = _compute_metrics(samples, pattern_types)

    header = [
        "## 4. Results Table (Auto-Generated)",
        "",
        f"Dataset path: `{dataset_dir}`",
        f"Total samples: {len(samples)}",
        "",
        _render_table(metrics),
    ]

    _update_report(REPORT_PATH, "\n".join(header))

    print(f"Report updated: {REPORT_PATH}")


if __name__ == "__main__":
    main()
