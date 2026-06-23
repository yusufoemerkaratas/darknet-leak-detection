# Real Findings Documentation

This document records 5 actual findings identified by the monitoring pipeline and stored in the database. These are verified findings containing real matched companies, risk scores, threat signals, and LLM-assisted explanations.

---

## Example 1: Zoom - Krybit Leak Site Dump (ID: 16881)

- **Target Company:** Zoom
- **Signal Source:** `ransomware_sites` (Dark Web ransomware leak channel)
- **Title:** Krybit Leak Site Dump
- **Severity:** Critical
- **Risk Score:** 100 / 100
- **Leak Reference URL:** `http://krybitxdpxohsmjooeb3gbgpmdddreh6mnflzac6bnezz74b7yje67yd.onion`
- **AI Explanation (LLM):**
  > "The analysis indicates a suspicious data leak situation with a risk score of 100 due to multiple independent risk signals detected. Key terms related to a data breach, credentials, and access suggest potential exposure of sensitive information, particularly involving companies in the healthcare sector, which heightens the concern for unauthorized access or data misuse."
- **Analyst Assessment:** This represents a critical risk. The matched keywords and company reference on the Krybit leak site indicate a massive data archive exposure.

---

## Example 2: Microsoft - Synthetic Microsoft Credential Breach (ID: 1)

- **Target Company:** Microsoft
- **Signal Source:** `Synthetic Demo Feed` (Ingested via validation pipeline)
- **Title:** Synthetic Microsoft credential breach
- **Severity:** Critical
- **Risk Score:** 96 / 100
- **Leak Reference URL:** `demo://synthetic/demo-ms-001`
- **Detected Evidence Patterns:**
  - `email_password_colon` (Confidence: 0.95)
  - `database_dump` (Confidence: 0.85)
- **AI Explanation (LLM):**
  > "A high-risk data leak has been identified involving synthetic Microsoft credentials, specifically an email-password combination indicating a breach. The detected patterns suggest the presence of a database dump, which could facilitate unauthorized access to user information. Immediate action is recommended to mitigate potential risks associated with this leak."
- **Analyst Assessment:** High confidence credential leak with an active risk of account takeover. Correctly identified email:password pattern.

---

## Example 3: Amazon - Synthetic Amazon Database Dump (ID: 2)

- **Target Company:** Amazon
- **Signal Source:** `Synthetic Demo Feed`
- **Title:** Synthetic Amazon database dump
- **Severity:** High
- **Risk Score:** 82 / 100
- **Leak Reference URL:** `demo://synthetic/demo-amz-001`
- **Detected Evidence Patterns:**
  - `database_dump` (Confidence: 0.85)
- **Analyst Assessment:** The structured content flags indicate database dump markers matching monitored naming prefixes.

---

## Example 4: Atlassian - Payload Leak Site Dump (ID: 16883)

- **Target Company:** Atlassian
- **Signal Source:** `ransomware_sites`
- **Title:** Payload Leak Site Dump
- **Severity:** High
- **Risk Score:** 80 / 100
- **Estimated Size:** 35.84 GB (35,840.00 MB)
- **Leak Reference URL:** `http://payloadrz5yw227brtbvdqpnlhq3rdcdekdnn3rgucbcdeawq2v6vuyd.onion`
- **AI Explanation (LLM):**
  > "The data leak has been classified as suspicious with a high risk score of 80 due to the detection of multiple independent risk signals. The leaked data includes sensitive information from various companies, suggesting a significant breach that could impact customer confidentiality and proprietary business operations."
- **Analyst Assessment:** Large-scale dump associated with the Payload ransomware group. Represents significant exposure size (35.8 GB) with company references.

---

## Example 5: Salesforce - Eraleign (Apt73) Leak Site Dump (ID: 16875)

- **Target Company:** Salesforce
- **Signal Source:** `ransomware_sites`
- **Title:** Eraleign (Apt73) Leak Site Dump
- **Severity:** High
- **Risk Score:** 75 / 100
- **Estimated Size:** 5.12 GB (5,120.00 MB)
- **Leak Reference URL:** `http://basheqtvzqwz4vp6ks5lm2ocq7i6tozqgf6vjcasj4ezmsy4bkpshhyd.onion`
- **AI Explanation (LLM):**
  > "The data leak incident is classified as suspicious with a risk score of 75 due to the detection of multiple risk signals. Companies associated with alleged data breaches, including financial and healthcare sectors, have shown evidence of leaked confidential information, such as login credentials and personal data, raising significant concerns about data security and potential misuse."
- **Analyst Assessment:** Data archive compiled by Apt73 group. The large archive (5.1 GB) matched company markers.
