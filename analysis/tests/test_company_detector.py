from analysis.detectors.company_detector import CompanyDetector


def test_short_alias_does_not_match_inside_unrelated_words():
    detector = CompanyDetector(
        [
            {
                "name": "Microsoft",
                "aliases": ["MS", "MSFT", "Micro$oft"],
                "domains": ["microsoft.com"],
            }
        ]
    )

    assert detector.detect("systems maintenance report") == []


def test_company_alias_and_domain_still_match():
    detector = CompanyDetector(
        [
            {
                "name": "Microsoft",
                "aliases": ["MS", "MSFT", "Micro$oft"],
                "domains": ["microsoft.com"],
            },
            {
                "name": "Amazon",
                "aliases": ["AWS", "AMZN"],
                "domains": ["amazon.com"],
            },
        ]
    )

    results = detector.detect("MSFT tenant and user@microsoft.com with AWS tooling")

    microsoft_matches = [
        (result.company_name, result.match_type, result.matched_term)
        for result in results
        if result.company_name == "Microsoft"
    ]
    assert ("Microsoft", "exact", "Microsoft") in microsoft_matches or (
        "Microsoft",
        "alias",
        "MSFT",
    ) in microsoft_matches
    assert ("Amazon", "alias", "AWS") in [
        (result.company_name, result.match_type, result.matched_term) for result in results
    ]


def test_literal_punctuation_alias_matches_exact_text():
    detector = CompanyDetector(
        [
            {
                "name": "Microsoft",
                "aliases": ["Micro$oft"],
                "domains": [],
            }
        ]
    )

    results = detector.detect("Micro$oft was referenced directly in the post")

    assert len(results) == 1
    assert results[0].company_name == "Microsoft"
    assert results[0].matched_term == "Micro$oft"
