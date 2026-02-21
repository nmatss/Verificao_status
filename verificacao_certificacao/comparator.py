"""Text comparison for certification validation (3 levels)."""

import re
import unicodedata
from typing import Tuple

from .models import ValidationStatus


def normalize_basic(text: str) -> str:
    """Level 1: Basic normalization - lowercase, collapse whitespace."""
    text = text.lower().strip()
    text = re.sub(r'\s+', ' ', text)
    return text


def normalize_unicode(text: str) -> str:
    """Level 2: Unicode NFKD normalization, remove punctuation, normalize spacing."""
    text = normalize_basic(text)
    # NFKD decomposition - normalizes accented characters
    text = unicodedata.normalize("NFKD", text)
    # Remove combining characters (accents)
    text = "".join(c for c in text if not unicodedata.combining(c))
    # Normalize space after colon
    text = re.sub(r':\s*', ': ', text)
    # Remove extra punctuation that might differ
    text = re.sub(r'[.,;!?()]+', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_identifiers(text: str) -> dict:
    """Level 3: Extract critical numerical identifiers from certification text.

    Returns dict with found identifiers:
        - inmetro_registro: e.g., "006561/2022"
        - inmetro_ocp: e.g., "0098"
        - anatel_code: e.g., "15743-20-13462"
    """
    ids = {}

    # INMETRO registro: XXXXXX/YYYY pattern
    registro_match = re.search(r'(?:registro|nº\s+registro)\s*(\d{4,6}/\d{4})', text, re.IGNORECASE)
    if registro_match:
        ids["inmetro_registro"] = registro_match.group(1)

    # OCP number
    ocp_match = re.search(r'OCP\s*(\d{4})', text, re.IGNORECASE)
    if ocp_match:
        ids["inmetro_ocp"] = ocp_match.group(1)

    # ANATEL homologation code: XXXXX-XX-XXXXX
    anatel_match = re.search(r'(\d{4,5}-\d{2}-\d{4,5})', text)
    if anatel_match:
        ids["anatel_code"] = anatel_match.group(1)

    # Certificate number: e.g., 7796/2022-BRI-1
    cert_match = re.search(r'(\d+/\d{4}-[A-Z]+-\d+)', text)
    if cert_match:
        ids["cert_number"] = cert_match.group(1)

    return ids


def compare_texts(expected: str, actual: str) -> Tuple[ValidationStatus, float]:
    """Compare expected vs actual certification text using 3 levels.

    Returns:
        Tuple of (ValidationStatus, similarity_score 0.0-1.0).
    """
    if not actual:
        return ValidationStatus.MISSING, 0.0

    if not expected:
        return ValidationStatus.NO_EXPECTED, 0.0

    # Level 1: Exact match (after basic normalization)
    norm_expected = normalize_basic(expected)
    norm_actual = normalize_basic(actual)

    if norm_expected in norm_actual or norm_actual in norm_expected:
        return ValidationStatus.OK, 1.0

    # Level 2: Unicode-normalized match
    uni_expected = normalize_unicode(expected)
    uni_actual = normalize_unicode(actual)

    if uni_expected in uni_actual or uni_actual in uni_expected:
        return ValidationStatus.OK, 0.95

    # Level 3: Identifier comparison
    expected_ids = extract_identifiers(expected)
    actual_ids = extract_identifiers(actual)

    if expected_ids and actual_ids:
        # Check if all expected identifiers are present in actual
        matching = 0
        total = len(expected_ids)

        for key, value in expected_ids.items():
            if key in actual_ids and actual_ids[key] == value:
                matching += 1

        if total > 0 and matching == total:
            return ValidationStatus.OK, 0.9

        if matching > 0:
            score = matching / total
            if score >= 0.5:
                return ValidationStatus.INCONSISTENT, score
            return ValidationStatus.INCONSISTENT, score

    # No identifiers matched or found - texts are clearly different
    # Calculate a rough similarity
    words_expected = set(uni_expected.split())
    words_actual = set(uni_actual.split())
    if words_expected and words_actual:
        intersection = words_expected & words_actual
        score = len(intersection) / max(len(words_expected), len(words_actual))
    else:
        score = 0.0

    return ValidationStatus.INCONSISTENT, score
