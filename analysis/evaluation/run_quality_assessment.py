import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

ROOT_DIR = Path(__file__).resolve().parents[2]
sys.path.append(str(ROOT_DIR))
DEFAULT_INPUT_DIRS = [
    ROOT_DIR / "collectors" / "processed_storage",
    ROOT_DIR / "collectors" / "raw_storage",
]
DEMO_DATASET_DIR = ROOT_DIR / "docs" / "analysis" / "synthetic_quality_dataset"
ASSESSMENT_REPORT_PATH = ROOT_DIR / "docs" / "analysis" / "data-quality-assessment.md"
REAL_FINDINGS_REPORT_PATH = ROOT_DIR / "docs" / "demo" / "real-findings-sprint2.md"

TEXT_FIELDS = (
    "full_body_text",
    "raw_content",
    "body",
    "body_preview",
    "content",
    "text",
    "title",
)


@dataclass
class QualityDocument:
    path: str
    text: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class QualityAssessment:
    total_documents: int
    analyzed_documents: int
    relevant_documents: int
    spam_documents: int
    duplicate_documents: int
    leak_quality_score: float
    language_distribution: Dict[str, int]
    classification_counts: Dict[str, int]
    pattern_counts: Dict[str, int]
    terminology_counts: Dict[str, int]
    terminology_false_positive_candidates: int
    classification_accuracy: Optional[float]
    confidence_by_pattern: Dict[str, Dict[str, float]]
    real_finding_candidates: List[Dict[str, Any]]
    recommendations: List[str]


def collect_documents(input_dirs: Iterable[Path], limit: Optional[int] = None) -> List[QualityDocument]:
    documents: List[QualityDocument] = []

    for input_dir in input_dirs:
        if not input_dir.exists():
            continue

        for path in sorted(input_dir.rglob("*")):
            if not path.is_file() or path.name.startswith("."):
                continue
            if path.suffix.lower() not in {".json", ".txt", ".md"}:
                continue

            document = load_document(path)
            if document and document.text.strip():
                documents.append(document)
                if limit and len(documents) >= limit:
                    return documents

    return documents


def load_document(path: Path) -> Optional[QualityDocument]:
    try:
        if path.suffix.lower() == ".json":
            data = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
            text = extract_text(data)
            metadata = data if isinstance(data, dict) else {}
            return QualityDocument(path=str(path), text=text, metadata=metadata)

        text = path.read_text(encoding="utf-8", errors="ignore")
        return QualityDocument(path=str(path), text=text, metadata={})
    except Exception:
        return None


def extract_text(data: Any) -> str:
    if isinstance(data, str):
        return data
    if not isinstance(data, dict):
        return ""

    parts = []
    for field in TEXT_FIELDS:
        value = data.get(field)
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
    return "\n".join(parts)


def assess_documents(
    documents: List[QualityDocument],
    engine: Optional[Any] = None,
) -> QualityAssessment:
    if engine is None:
        from analysis.analysis_engine import AnalysisEngine

        engine = AnalysisEngine()
    seen_hashes = set()
    language_distribution: Counter = Counter()
    classification_counts: Counter = Counter()
    pattern_counts: Counter = Counter()
    terminology_counts: Counter = Counter()
    confidence_values: Dict[str, List[float]] = defaultdict(list)
    real_candidates: List[Dict[str, Any]] = []
    labeled_total = 0
    labeled_correct = 0
    spam_documents = 0
    duplicate_documents = 0
    relevant_documents = 0
    terminology_false_positive_candidates = 0

    for document in documents:
        text_hash = hashlib.sha256(document.text.encode("utf-8", errors="replace")).hexdigest()
        if text_hash in seen_hashes:
            duplicate_documents += 1
        seen_hashes.add(text_hash)

        result = engine.analyze(document.text)
        parser_meta = document.metadata.get("parser", {})
        language = (
            document.metadata.get("language")
            or parser_meta.get("language")
            or "unknown"
        )
        language_distribution[str(language)] += 1
        classification_counts[result.classification] += 1

        if result.classification != "irrelevant":
            relevant_documents += 1

        if bool(document.metadata.get("is_spam") or parser_meta.get("is_spam")):
            spam_documents += 1

        expected = document.metadata.get("expected_classification")
        if expected:
            labeled_total += 1
            if str(expected).lower() == result.classification:
                labeled_correct += 1

        for pattern in result.detected_patterns:
            pattern_type = str(pattern.get("pattern_type"))
            pattern_counts[pattern_type] += 1
            confidence_values[pattern_type].append(float(pattern.get("confidence", 0.0)))

        for term in result.terminology_hits:
            terminology_counts[str(term.get("term"))] += int(term.get("count", 1))

        if result.terminology_hits and result.classification == "irrelevant":
            terminology_false_positive_candidates += 1

        if result.classification in {"high-risk", "suspicious"}:
            real_candidates.append({
                "path": document.path,
                "classification": result.classification,
                "risk_score": result.risk_score,
                "company": result.best_company_name or "Unknown",
                "patterns": [p.get("pattern_type") for p in result.detected_patterns],
                "terms": [t.get("term") for t in result.terminology_hits],
                "signals": result.signal_flags,
            })

    confidence_by_pattern = {
        pattern: {
            "count": float(len(values)),
            "average_confidence": round(sum(values) / len(values), 3),
        }
        for pattern, values in confidence_values.items()
        if values
    }

    total_documents = len(documents)
    leak_quality_score = (
        round(relevant_documents / total_documents, 3)
        if total_documents
        else 0.0
    )
    classification_accuracy = (
        round(labeled_correct / labeled_total, 3)
        if labeled_total
        else None
    )

    recommendations = build_recommendations(
        total_documents=total_documents,
        leak_quality_score=leak_quality_score,
        duplicate_documents=duplicate_documents,
        spam_documents=spam_documents,
        terminology_false_positive_candidates=terminology_false_positive_candidates,
    )

    return QualityAssessment(
        total_documents=total_documents,
        analyzed_documents=total_documents,
        relevant_documents=relevant_documents,
        spam_documents=spam_documents,
        duplicate_documents=duplicate_documents,
        leak_quality_score=leak_quality_score,
        language_distribution=dict(language_distribution),
        classification_counts=dict(classification_counts),
        pattern_counts=dict(pattern_counts),
        terminology_counts=dict(terminology_counts),
        terminology_false_positive_candidates=terminology_false_positive_candidates,
        classification_accuracy=classification_accuracy,
        confidence_by_pattern=confidence_by_pattern,
        real_finding_candidates=sorted(
            real_candidates,
            key=lambda item: item["risk_score"],
            reverse=True,
        )[:10],
        recommendations=recommendations,
    )


def build_recommendations(
    total_documents: int,
    leak_quality_score: float,
    duplicate_documents: int,
    spam_documents: int,
    terminology_false_positive_candidates: int,
) -> List[str]:
    recommendations = []

    if total_documents < 200:
        recommendations.append(
            "Collect at least 200 parsed documents before final calibration."
        )
    if leak_quality_score < 0.30:
        recommendations.append(
            "Keep high alert thresholds enabled because the current sample is noise-heavy."
        )
    if duplicate_documents:
        recommendations.append(
            "Review duplicate suppression because repeated documents were observed."
        )
    if spam_documents:
        recommendations.append(
            "Tune parser noise filtering before using this dataset for scoring calibration."
        )
    if terminology_false_positive_candidates:
        recommendations.append(
            "Review terminology hits in irrelevant documents and down-weight ambiguous terms."
        )
    if not recommendations:
        recommendations.append("No immediate tuning action required.")

    return recommendations


def render_assessment_report(assessment: QualityAssessment, input_dirs: List[Path]) -> str:
    return "\n".join([
        "# Real Data Quality Assessment",
        "",
        "## Dataset",
        "",
        f"- Input paths: {', '.join(str(path) for path in input_dirs)}",
        f"- Total documents: {assessment.total_documents}",
        f"- Analyzed documents: {assessment.analyzed_documents}",
        f"- Relevant documents: {assessment.relevant_documents}",
        f"- Spam/noise documents: {assessment.spam_documents}",
        f"- Duplicate documents: {assessment.duplicate_documents}",
        f"- Leak quality score: {assessment.leak_quality_score:.3f}",
        "",
        "## Language Distribution",
        "",
        render_count_table("Language", assessment.language_distribution),
        "",
        "## Classification Calibration",
        "",
        render_count_table("Classification", assessment.classification_counts),
        "",
        format_accuracy(assessment.classification_accuracy),
        "",
        "## Pattern Validation",
        "",
        render_count_table("Pattern Type", assessment.pattern_counts),
        "",
        "## Terminology Accuracy",
        "",
        render_count_table("Term", assessment.terminology_counts),
        "",
        f"- False-positive candidate documents: {assessment.terminology_false_positive_candidates}",
        "",
        "## Confidence Calibration",
        "",
        render_confidence_table(assessment.confidence_by_pattern),
        "",
        "## Tuning Decisions",
        "",
        "\n".join(f"- {item}" for item in assessment.recommendations),
        "",
        "## False Positive Handling Strategy",
        "",
        "- Keep analyst review as the final gate for suspicious and high-risk findings.",
        "- Prefer score thresholds of 80+ for escalation when the dataset is noise-heavy.",
        "- Use false-positive review notes as feedback for terminology and pattern tuning.",
        "- Re-run this assessment after each collector calibration pass.",
        "",
    ])


def render_real_findings_report(assessment: QualityAssessment) -> str:
    lines = [
        "# Real Findings Identified in Sprint 2",
        "",
        "This report lists the strongest manually reviewable candidates produced by the",
        "quality assessment pipeline. It does not expose raw leak content.",
        "",
    ]

    if not assessment.real_finding_candidates:
        lines.extend([
            "No suspicious or high-risk finding candidates were available in the local dataset.",
            "",
            "Next action: run collectors and ingestion until at least 200 parsed documents are available,",
            "then re-run `python analysis/evaluation/run_quality_assessment.py --write`.",
            "",
        ])
        return "\n".join(lines)

    lines.append("| Rank | Classification | Score | Company | Signals | Source |")
    lines.append("|---|---|---:|---|---|---|")

    for index, item in enumerate(assessment.real_finding_candidates, start=1):
        signals = ", ".join(
            str(value)
            for value in (item["patterns"] + item["terms"])
            if value
        ) or "scoring signals"
        lines.append(
            f"| {index} | {item['classification']} | {item['risk_score']} | "
            f"{item['company']} | {signals} | `{item['path']}` |"
        )

    lines.append("")
    return "\n".join(lines)


def render_count_table(label: str, values: Dict[str, int]) -> str:
    if not values:
        return f"No {label.lower()} data available."

    lines = [f"| {label} | Count |", "|---|---:|"]
    for key, count in sorted(values.items(), key=lambda item: (-item[1], item[0])):
        lines.append(f"| {key} | {count} |")
    return "\n".join(lines)


def render_confidence_table(values: Dict[str, Dict[str, float]]) -> str:
    if not values:
        return "No confidence data available."

    lines = ["| Pattern Type | Matches | Average Confidence |", "|---|---:|---:|"]
    for pattern, data in sorted(values.items()):
        lines.append(
            f"| {pattern} | {int(data['count'])} | {data['average_confidence']:.3f} |"
        )
    return "\n".join(lines)


def format_accuracy(value: Optional[float]) -> str:
    if value is None:
        return "Classification accuracy: not available because the dataset is not labeled."
    return f"Classification accuracy: {value:.3f}"


def write_reports(assessment: QualityAssessment, input_dirs: List[Path]) -> None:
    ASSESSMENT_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REAL_FINDINGS_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    ASSESSMENT_REPORT_PATH.write_text(
        render_assessment_report(assessment, input_dirs),
        encoding="utf-8",
    )
    REAL_FINDINGS_REPORT_PATH.write_text(
        render_real_findings_report(assessment),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        action="append",
        dest="inputs",
        help="Input directory with raw or processed collector documents. Can be repeated.",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Use the committed synthetic demo dataset instead of collector output.",
    )
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--write", action="store_true", help="Write markdown reports.")
    args = parser.parse_args()

    if args.demo:
        input_dirs = [DEMO_DATASET_DIR]
    elif args.inputs:
        input_dirs = [Path(path) for path in args.inputs]
    else:
        input_dirs = DEFAULT_INPUT_DIRS
    documents = collect_documents(input_dirs, limit=args.limit)
    assessment = assess_documents(documents)

    print(render_assessment_report(assessment, input_dirs))

    if args.write:
        write_reports(assessment, input_dirs)
        print(f"Reports written: {ASSESSMENT_REPORT_PATH}, {REAL_FINDINGS_REPORT_PATH}")


if __name__ == "__main__":
    main()
