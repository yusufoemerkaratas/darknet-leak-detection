# Analysis Criteria – Leak Detection System

## 1. Company Matching Rules

### 1.1 Exact Match (Case-Insensitive)

The company name or any registered alias is found verbatim in the normalised text, regardless of capitalisation. The match is performed after lowercasing both the input text and the target name.

| Input Text | Company Name | Result |
|---|---|---|
| "microsoft data exposed" | Microsoft | Match |
| "MICROSOFT breach" | Microsoft | Match |
| "microsft hack" | Microsoft | No match, forwarded to fuzzy |

### 1.2 Alias Matching

A predefined alias table maps short-form identifiers and common abbreviations to canonical company names. An alias match is treated as an exact match for scoring purposes.

| Canonical Name | Accepted Aliases |
|---|---|
| Microsoft | MSFT, MS, Microsoft Corp |
| Amazon | AMZN, AWS, Amazon.com |
| Google | GOOGL, Alphabet, GCP |
| Meta | FB, Facebook, Instagram |
| Apple | AAPL, Apple Inc |

### 1.3 Fuzzy Matching

Applied only when no exact or alias match is found. The similarity is calculated using the Levenshtein ratio. The minimum accepted threshold is 90 percent. Any finding produced by a fuzzy match receives a penalty of minus 3 points applied to the final score.

| Input | Target | Similarity | Result |
|---|---|---|---|
| "Microsft" | Microsoft | 94% | Accepted, penalty applied |
| "Amazom" | Amazon | 92% | Accepted, penalty applied |
| "Moogle" | Google | 72% | Rejected, below threshold |

---

## 2. Domain Matching Rules

### 2.1 Exact Domain Match

The monitored domain string appears verbatim in the document text.

```
Pattern : microsoft.com
Match   : "visit microsoft.com for support"
No Match: "visit microsoft-corp.net"
```

### 2.2 Subdomain Match

Any subdomain of the monitored root domain is accepted as a valid match.

```
Pattern : *.microsoft.com
Matches : internal.microsoft.com
          mail.microsoft.com
          vpn.internal.microsoft.com
```

### 2.3 Email Domain Match

Email addresses whose domain portion corresponds to the monitored domain are accepted.

```
Pattern : @microsoft.com
Matches : john.doe@microsoft.com
          admin@mail.microsoft.com
```

---

## 3. Classification Rules

Classification is determined by the final numeric score produced by the scoring formula. Four categories are defined.

| Classification | Score Range | Condition |
|---|---|---|
| Irrelevant | 0 to 30 | No meaningful signals detected |
| Related | 31 to 50 | One or two weak signals, no company or domain match confirmed |
| Suspicious | 51 to 80 | Two or more signals present and company or domain matched |
| High-Risk | 81 to 100 | Credential pattern confirmed and company match confirmed |

All scores are capped at a maximum of 100 points.

---

## 4. Classification Examples

### 4.1 Irrelevant

**Scenario:** A forum post advertising a commercial VPN service using generic privacy language.

**Sample text:**
"Get the best VPN deal this week. Fast servers, secure browsing, no activity records kept. Contact us for a trial."

**Signal evaluation:**
- No company name detected
- No domain detected
- No credential pattern detected
- Low-priority terminology present but conditional rule not satisfied
- Low confidence applied

**Estimated score:** 0 — Classification: Irrelevant

---

### 4.2 Related

**Scenario:** A forum thread discussing a reported Microsoft service outage. No leaked data is attached or referenced.

**Sample text:**
"Microsoft had a major outage last week. Many enterprise users were affected. Some speculate it was an insider incident. No evidence has been published."

**Signal evaluation:**
- Company match confirmed: Microsoft, exact
- No domain match
- No credential pattern detected
- No high or medium priority terminology matched
- Low confidence applied, claim unverified

**Score calculation:**

| Signal | Points |
|---|---|
| Company match | +25 |
| Low confidence | -5 |
| Total | 20 |

**Estimated score:** 20 — Classification: Related

---

### 4.3 Suspicious

**Scenario:** A paste-site entry referencing Amazon with an email domain present and several medium-priority terminology matches. No credential file is attached.

**Sample text:**
"Amazon AWS internal user data available. Transaction logs and client list included. Contact via user@amazon.com for access details."

**Signal evaluation:**
- Company match confirmed: Amazon, exact
- Domain match confirmed: @amazon.com
- Terminology high: access
- Terminology medium: user data, client list, transaction
- Multiple signals bonus applies
- Low confidence applied, no file attached

**Score calculation:**

| Signal | Points |
|---|---|
| Company match | +25 |
| Domain match | +20 |
| Terminology high: access | +15 |
| Terminology medium: user data | +10 |
| Terminology medium: client list | +10 |
| Terminology medium: transaction | +10 |
| Multiple signals bonus | +5 |
| Low confidence | -5 |
| Total | 90 — capped at 80 boundary |

**Estimated score:** 80 — Classification: Suspicious

---

### 4.4 High-Risk

**Scenario:** A darknet forum post containing a verified email and password list attributed to Microsoft employees, with database dump syntax visible in the attached file.

**Sample text:**
"Fresh Microsoft breach. 50 000 credentials confirmed. Database dump attached. john.doe@microsoft.com:Password2024 jane.smith@microsoft.com:Summer2024"

**Signal evaluation:**
- Company match confirmed: Microsoft, exact
- Domain match confirmed: @microsoft.com
- Credential pattern confirmed: email:password
- Database dump pattern confirmed: INSERT INTO present in attachment
- Terminology high: breach, credentials, leaked
- Multiple signals bonus applies

**Score calculation:**

| Signal | Points |
|---|---|
| Company match | +25 |
| Domain match | +20 |
| Credential pattern | +30 |
| Database dump | +35 |
| Terminology high: breach | +15 |
| Terminology high: credentials | +15 |
| Terminology high: leaked | +15 |
| Multiple signals bonus | +5 |
| Subtotal | 160 |
| Cap applied | 100 |

**Estimated score:** 100 — Classification: High-Risk

---

## 5. Credential Pattern Templates

### Pattern 1 – Email and Password, Colon Separator

```
Regex   : [a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}:[^\s:]{6,}
Example : john.doe@microsoft.com:Password2024
```

### Pattern 2 – Email and Password, Pipe Separator

```
Regex   : [a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\|[^\s|]{6,}
Example : john.doe@microsoft.com|Summer2024
```

### Pattern 3 – Email and Password, Double-Colon Separator

```
Regex   : [a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}::[^\s:]{6,}
Example : admin@amazon.com::securepass99
```

### Pattern 4 – Username and Hash

MD5 hash, 32 hexadecimal characters:

```
Regex   : \b\w+:[a-fA-F0-9]{32}\b
Example : jdoe:5f4dcc3b5aa765d61d8327deb882cf99
```

SHA1 hash, 40 hexadecimal characters:

```
Regex   : \b\w+:[a-fA-F0-9]{40}\b
Example : jdoe:5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8
```

Bcrypt hash:

```
Regex   : \b\w+:\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}
Example : jdoe:$2a$12$KIXyL1n0SjHtOdMk8xSJBOlkW5v1
```

### Pattern 5 – Database Dump Statements

```
Regex   : (INSERT\s+INTO\s+\w+|CREATE\s+TABLE\s+\w+)
Example : INSERT INTO users (id, email, password) VALUES (1, 'a@b.com', 'hash');
          CREATE TABLE customers (id INT, name VARCHAR, card_no VARCHAR);
```

### Pattern 6 – Private Keys

RSA private key block:

```
Regex   : -----BEGIN RSA PRIVATE KEY-----[\s\S]+?-----END RSA PRIVATE KEY-----
Example : -----BEGIN RSA PRIVATE KEY-----
          MIIEowIBAAKCAQEA...
          -----END RSA PRIVATE KEY-----
```

OpenSSH private key block:

```
Regex   : -----BEGIN OPENSSH PRIVATE KEY-----[\s\S]+?-----END OPENSSH PRIVATE KEY-----
Example : -----BEGIN OPENSSH PRIVATE KEY-----
          b3BlbnNzaC1rZXktdjEAAAA...
          -----END OPENSSH PRIVATE KEY-----
```

### Pattern 7 – API Keys

AWS access key:

```
Regex   : AKIA[0-9A-Z]{16}
Example : AKIAIOSFODNN7EXAMPLE
```

Stripe live secret key:

```
Regex   : sk_live_[a-zA-Z0-9]{24,}
Example : sk_live_4eC39HqLyjWDarjtT1zdp7dc
```

GitHub personal access token:

```
Regex   : ghp_[a-zA-Z0-9]{36}
Example : ghp_16C7e42F292c6912E7710c838347Ae178B4a
```

---

## 6. Pattern Precision Targets

The minimum accepted precision for all pattern types is 80 percent, evaluated against the labeled demo dataset defined in Issue 24.

| Pattern Type | Estimated Precision |
|---|---|
| Email and password patterns | 95% |
| Username and hash patterns | 90% |
| Database dump statements | 85% |
| Private key blocks | 99% |
| API key patterns | 97% |
| Terminology-based matching | 80% |
