# Scoring Formula – Leak Detection System

## 1. Overview

Every document processed by the analysis engine receives a numeric risk score between 0 and 100. The score is computed by summing all detected signal points, applying any adjustments, and capping the result at the defined maximum.

```
Final Score = min( (Base + Sum of Signals + Bonus) + Adjustments , 100 )
```

---

## 2. Base Score

Every document begins with a base score of zero regardless of its source or content type.

| Component | Points |
|---|---|
| Base | 0 |

---

## 3. Signal Points

Each signal listed below is evaluated independently. Multiple signals of the same type are not stacked unless explicitly stated.

| Signal | Points |
|---|---|
| Company name matched, exact or alias | +25 |
| Domain matched, exact, subdomain or email | +20 |
| Credential pattern detected | +30 |
| Database dump detected | +35 |
| Leak terminology, high priority term | +15 |
| Leak terminology, medium priority term | +10 |
| Multiple signals bonus, three or more distinct signals | +5 |

The multiple signals bonus is applied once regardless of how many signals exceed the threshold of three.

---

## 4. Adjustments

Adjustments are applied after all signal points are summed. They represent reductions in confidence based on match quality or source reliability.

| Condition | Adjustment |
|---|---|
| Low confidence, unverified claim, single source, no attachment | -5 |
| Fuzzy match used in place of exact or alias match | -3 |

---

## 5. Score Cap and Floor

```
Maximum score : 100 points
Minimum score : 0 points
```

If the calculated total exceeds 100 it is reduced to 100. If the total falls below 0 after adjustments it is raised to 0.

---

## 6. Classification Thresholds

| Score Range | Classification |
|---|---|
| 0 to 30 | Irrelevant |
| 31 to 50 | Related |
| 51 to 80 | Suspicious |
| 81 to 100 | High-Risk |

---

## 7. Scoring Examples

### Example A – Irrelevant

**Document:** A commercial advertisement for a VPN service using generic privacy language. No company name, domain or credential pattern is present.

| Signal | Points |
|---|---|
| Base | 0 |
| No company match | 0 |
| Low-priority term present but conditional rule not satisfied | 0 |
| Low confidence | -5 |
| Total | -5, floored to 0 |
| **Final Score** | **0 — Irrelevant** |

---

### Example B – Related

**Document:** A forum thread discussing a reported Microsoft outage. No leaked data, no attachment, no credential pattern.

| Signal | Points |
|---|---|
| Base | 0 |
| Company match: Microsoft, exact | +25 |
| No domain match | 0 |
| No credential pattern | 0 |
| Low confidence, unverified rumour, no attachment | -5 |
| Total | 20 |
| **Final Score** | **20 — Related** |

---

### Example C – Suspicious

**Document:** A paste-site entry referencing Amazon with an email domain present and several medium-priority terminology matches. No credential file is attached.

| Signal | Points |
|---|---|
| Base | 0 |
| Company match: Amazon, exact | +25 |
| Domain match: @amazon.com | +20 |
| Terminology high: access | +15 |
| Terminology medium: user data | +10 |
| Terminology medium: client list | +10 |
| Terminology medium: transaction | +10 |
| Multiple signals bonus | +5 |
| Low confidence, no file attached | -5 |
| Total | 90, capped at boundary |
| **Final Score** | **80 — Suspicious** |

---

### Example D – High-Risk

**Document:** A darknet forum post containing a verified email and password list attributed to Microsoft employees, with database dump syntax present in the attached file.

| Signal | Points |
|---|---|
| Base | 0 |
| Company match: Microsoft, exact | +25 |
| Domain match: @microsoft.com | +20 |
| Credential pattern: email and password | +30 |
| Database dump: INSERT INTO detected | +35 |
| Terminology high: breach | +15 |
| Terminology high: credentials | +15 |
| Terminology high: leaked | +15 |
| Multiple signals bonus | +5 |
| Subtotal | 160 |
| Cap applied | 100 |
| **Final Score** | **100 — High-Risk** |

---

## 8. Formula Summary

```
score = 0
score += 25   # if company matched by exact or alias
score += 20   # if domain matched by exact, subdomain or email
score += 30   # if credential pattern detected
score += 35   # if database dump detected
score += 15   # per high-priority terminology match
score += 10   # per medium-priority terminology match
score += 5    # if three or more distinct signals present, applied once
score -= 5    # if low confidence
score -= 3    # if fuzzy match was used
score  = min(score, 100)
score  = max(score, 0)
```

---

## 9. Precision and Recall Targets

These targets are evaluated against the labeled demo dataset defined in Issue 24.

| Metric | Target |
|---|---|
| Pattern precision | 80% or above |
| False positive rate | 20% or below |
| High-Risk recall | 90% or above |
