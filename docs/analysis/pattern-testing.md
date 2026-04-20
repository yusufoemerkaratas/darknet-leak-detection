# Pattern Testing – Credential & Pattern Detection

## 1. Testing Methodology

All credential and pattern detectors are evaluated using a **labeled demo dataset** (see Issue #24). Each text sample in the dataset is manually annotated with:

- The expected pattern types present (ground truth labels).
- The expected match positions and line numbers.

The evaluation pipeline runs each detector against the full dataset and compares predicted detections with ground truth annotations to compute standard information-retrieval metrics.

### Evaluation metrics

| Metric | Definition |
|---|---|
| **True Positive (TP)** | Pattern correctly detected where ground truth confirms presence |
| **False Positive (FP)** | Pattern reported but not present in ground truth |
| **False Negative (FN)** | Pattern present in ground truth but not detected |
| **Precision** | TP / (TP + FP) — accuracy of positive predictions |
| **Recall** | TP / (TP + FN) — coverage of actual positives |

---

## 2. Dataset Description

### Demo dataset

The demo dataset is a curated collection of synthetic and anonymised text samples representing typical leak scenarios. It is designed for development-time validation and is **not** derived from real-world sensitive data.

| Property | Value |
|---|---|
| Total samples | 50 |
| Labeled positive samples | 35 |
| Labeled negative samples | 15 |
| Format | Plain text, one sample per file |
| Annotation format | YAML sidecar per sample |

### Sample categories

- **Credential dumps** — email:password, email|password, email::password pairs.
- **Hashed credentials** — username:MD5, username:SHA-1, username:bcrypt pairs.
- **Database exports** — SQL INSERT INTO / CREATE TABLE fragments.
- **Private keys** — RSA and OpenSSH PEM blocks.
- **API keys** — AWS (AKIA), Stripe (sk\_live\_), GitHub (ghp\_) tokens.
- **Config secrets** — DB\_PASSWORD, API\_KEY, SECRET\_TOKEN assignments.
- **Negative samples** — marketing text, news articles, forum posts with no leak content.

---

## 3. Precision and Recall Targets

Targets are aligned with the project-wide requirements defined in `docs/analysis/scoring_formula.md` §9.

| Metric | Target |
|---|---|
| **Precision** (all patterns) | ≥ 80% |
| **Recall** (all patterns) | ≥ 70% |
| **High-Risk recall** | ≥ 90% |
| **False positive rate** | ≤ 20% |

---

## 4. Results Table

Results per pattern type, evaluated against the demo dataset.

| Pattern Type | Samples | TP | FP | FN | Precision | Recall | Status |
|---|---|---|---|---|---|---|---|
| email\_password\_colon | — | — | — | — | — | — | Pending |
| email\_password\_pipe | — | — | — | — | — | — | Pending |
| email\_password\_double\_colon | — | — | — | — | — | — | Pending |
| username\_md5 | — | — | — | — | — | — | Pending |
| username\_sha1 | — | — | — | — | — | — | Pending |
| username\_bcrypt | — | — | — | — | — | — | Pending |
| database\_dump | — | — | — | — | — | — | Pending |
| rsa\_private\_key | — | — | — | — | — | — | Pending |
| openssh\_private\_key | — | — | — | — | — | — | Pending |
| aws\_api\_key | — | — | — | — | — | — | Pending |
| stripe\_api\_key | — | — | — | — | — | — | Pending |
| github\_token | — | — | — | — | — | — | Pending |
| config\_db\_password | — | — | — | — | — | — | Pending |
| config\_api\_key | — | — | — | — | — | — | Pending |
| config\_secret\_token | — | — | — | — | — | — | Pending |

> **Note:** Results will be populated once the labeled demo dataset (Issue #24) is finalised and the evaluation pipeline is executed.

To generate results automatically, run:

```bash
python analysis/evaluation/run_pattern_tests.py
```

Dataset format is documented in [docs/analysis/test_dataset/README.md](docs/analysis/test_dataset/README.md).

<!-- AUTO-GENERATED:START -->
## 4. Results Table (Auto-Generated)

Dataset path: `docs/analysis/test_dataset`
Total samples: 0

| Pattern Type | Samples | TP | FP | FN | Precision | Recall | Status |
|---|---|---|---|---|---|---|---|
| email_password_colon | 0 | 0 | 0 | 0 | — | — | No data |
| email_password_pipe | 0 | 0 | 0 | 0 | — | — | No data |
| email_password_double_colon | 0 | 0 | 0 | 0 | — | — | No data |
| username_md5 | 0 | 0 | 0 | 0 | — | — | No data |
| username_sha1 | 0 | 0 | 0 | 0 | — | — | No data |
| username_bcrypt | 0 | 0 | 0 | 0 | — | — | No data |
| database_dump | 0 | 0 | 0 | 0 | — | — | No data |
| rsa_private_key | 0 | 0 | 0 | 0 | — | — | No data |
| openssh_private_key | 0 | 0 | 0 | 0 | — | — | No data |
| pgp_private_key | 0 | 0 | 0 | 0 | — | — | No data |
| aws_api_key | 0 | 0 | 0 | 0 | — | — | No data |
| stripe_api_key | 0 | 0 | 0 | 0 | — | — | No data |
| github_token | 0 | 0 | 0 | 0 | — | — | No data |
| config_db_password | 0 | 0 | 0 | 0 | — | — | No data |
| config_api_key | 0 | 0 | 0 | 0 | — | — | No data |
| config_secret_token | 0 | 0 | 0 | 0 | — | — | No data |
<!-- AUTO-GENERATED:END -->

---

## 5. Known Limitations and False Positive Categories

### 5.1 Known Limitations

| Limitation | Affected Patterns | Description |
|---|---|---|
| No multi-line password support | email\_password\_\* | Passwords containing whitespace or spanning multiple lines are not captured. |
| Minimum password length | email\_password\_\* | Passwords shorter than 6 characters are intentionally excluded to reduce false positives. |
| MD5/SHA-1 collision with hex strings | username\_md5, username\_sha1 | Legitimate hex identifiers (commit hashes, UUIDs) may match the hash pattern. |
| SQL keyword overlap | database\_dump | Programming tutorials or documentation containing INSERT INTO or CREATE TABLE will trigger false positives. |
| Config pattern simplicity | config\_\* | Only DB\_PASSWORD, API\_KEY, and SECRET\_TOKEN are covered. Other config key names are not detected. |

### 5.2 False Positive Categories

| Category | Description | Example |
|---|---|---|
| **Educational content** | Code tutorials showing credential formats as examples. | `user@example.com:password123` in a blog post about security best practices. |
| **Documentation** | Internal documentation referencing pattern formats without containing real credentials. | API docs showing `AKIA` prefix explanation. |
| **Hash-like identifiers** | Hexadecimal strings used as non-credential identifiers (git SHAs, UUIDs). | `admin:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4` as a session ID. |
| **SQL tutorials** | Database textbooks or course material containing DDL/DML statements. | `CREATE TABLE students (id INT, name VARCHAR(50));` |
| **Config templates** | Environment file templates with placeholder values. | `DB_PASSWORD=changeme` in a `.env.example` file. |

---

## 6. Future Improvements

- Integrate the labeled demo dataset (Issue #24) and automate precision/recall reporting in CI.
- Add context-aware scoring to down-weight matches found in known documentation or template files.
- Extend config patterns to support additional secret key names (e.g. `JWT_SECRET`, `DATABASE_URL`).
- Implement n-gram fuzzy matching for multi-word credential formats.
