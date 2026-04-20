"""
Credential & Pattern Detection Module.

Provides detector classes for identifying leaked credentials,
security-relevant terminology, and company references in text data.

Classes:
    CredentialDetector  — regex-based credential and secret pattern matching
    TerminologyDetector — keyword-based leak terminology detection
    CompanyDetector     — exact, domain, alias and fuzzy company name matching
"""

from analysis.detectors.credential_detector import CredentialDetector
from analysis.detectors.terminology_detector import TerminologyDetector
from analysis.detectors.company_detector import CompanyDetector

__all__ = [
    "CredentialDetector",
    "TerminologyDetector",
    "CompanyDetector",
]
