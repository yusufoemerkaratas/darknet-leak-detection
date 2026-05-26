from dataclasses import dataclass

from analysis.evaluation.run_quality_assessment import (
    QualityDocument,
    assess_documents,
    collect_documents,
    render_real_findings_report,
)


@dataclass
class FakeResult:
    risk_score: int
    classification: str
    classification_rule: str
    detected_patterns: list
    terminology_hits: list
    matched_companies: list
    score_breakdown: dict
    signal_flags: dict
    best_company_name: str | None = None


class FakeEngine:
    def analyze(self, text):
        if "credential" in text:
            return FakeResult(
                risk_score=92,
                classification="high-risk",
                classification_rule="fake high risk",
                detected_patterns=[
                    {"pattern_type": "email_password_colon", "confidence": 0.95}
                ],
                terminology_hits=[{"term": "breach", "count": 1}],
                matched_companies=[{"company_name": "Microsoft"}],
                score_breakdown={},
                signal_flags={"has_credential": True},
                best_company_name="Microsoft",
            )

        return FakeResult(
            risk_score=12,
            classification="irrelevant",
            classification_rule="fake irrelevant",
            detected_patterns=[],
            terminology_hits=[{"term": "log", "count": 1}],
            matched_companies=[],
            score_breakdown={},
            signal_flags={},
            best_company_name=None,
        )


def test_collect_documents_reads_json_and_text(tmp_path):
    json_path = tmp_path / "sample.json"
    text_path = tmp_path / "sample.txt"
    json_path.write_text(
        '{"title": "Leak", "body": "credential data", "language": "en"}',
        encoding="utf-8",
    )
    text_path.write_text("plain text document", encoding="utf-8")

    documents = collect_documents([tmp_path])

    assert len(documents) == 2
    assert any("credential data" in doc.text for doc in documents)
    assert any(doc.path.endswith("sample.txt") for doc in documents)


def test_assess_documents_calculates_quality_metrics():
    documents = [
        QualityDocument(
            path="one.json",
            text="credential data",
            metadata={"language": "en", "expected_classification": "high-risk"},
        ),
        QualityDocument(
            path="two.json",
            text="credential data",
            metadata={"language": "en", "expected_classification": "high-risk"},
        ),
        QualityDocument(
            path="three.json",
            text="marketing log",
            metadata={"language": "de", "is_spam": True},
        ),
    ]

    assessment = assess_documents(documents, engine=FakeEngine())

    assert assessment.total_documents == 3
    assert assessment.relevant_documents == 2
    assert assessment.duplicate_documents == 1
    assert assessment.spam_documents == 1
    assert assessment.leak_quality_score == 0.667
    assert assessment.language_distribution == {"en": 2, "de": 1}
    assert assessment.pattern_counts["email_password_colon"] == 2
    assert assessment.terminology_false_positive_candidates == 1
    assert assessment.classification_accuracy == 1.0
    assert len(assessment.real_finding_candidates) == 2


def test_real_findings_report_does_not_include_raw_content():
    assessment = assess_documents(
        [QualityDocument(path="one.json", text="credential data", metadata={})],
        engine=FakeEngine(),
    )

    report = render_real_findings_report(assessment)

    assert "high-risk" in report
    assert "one.json" in report
    assert "credential data" not in report
