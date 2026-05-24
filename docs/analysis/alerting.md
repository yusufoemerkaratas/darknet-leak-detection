# Alert Thresholds & Severity

## Trigger Conditions

An alert is created when ALL of the following are true:

- `risk_score >= 60`
- `classification` is `suspicious` or `high-risk`
- `is_false_positive` is `false`
- No duplicate exists within the last 7 days (see Deduplication)

## Severity Mapping

| Score Range | Severity |
|-------------|----------|
| 60 – 74     | LOW      |
| 75 – 89     | MEDIUM   |
| 90 – 100    | CRITICAL |

## Skip Conditions

An alert is skipped when any of the following are true:

- `is_false_positive = true`
- `classification = irrelevant`
- A duplicate finding exists within the last 7 days

## Deduplication

Within a 7-day window:

- Same `content_hash` → marked as duplicate, alert skipped
- Findings older than 7 days are not deduplicated (may be relevant again)
