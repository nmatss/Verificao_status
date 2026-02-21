"""Data models for the certification validation system."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Brand(Enum):
    IMAGINARIUM = "Imaginarium"
    PUKET = "Puket"
    PUKET_ESCOLARES = "Puket escolares"


class ValidationStatus(Enum):
    OK = "OK"
    MISSING = "MISSING"
    INCONSISTENT = "INCONSISTENT"
    URL_NOT_FOUND = "URL_NOT_FOUND"
    API_ERROR = "API_ERROR"
    NO_EXPECTED = "NO_EXPECTED"


@dataclass
class Product:
    sku: str
    name: str
    brand: Brand
    expected_cert_text: Optional[str]
    excel_row: int
    resolved_url: Optional[str] = None


@dataclass
class ValidationResult:
    product: Product
    status: ValidationStatus
    actual_cert_text: Optional[str] = None
    similarity_score: float = 0.0
    ai_assessment: Optional[str] = None
    error_message: Optional[str] = None
