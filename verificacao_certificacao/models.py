"""Data models for the certification validation system."""

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class Brand(Enum):
    IMAGINARIUM = "Imaginarium"
    PUKET = "Puket"
    PUKET_ESCOLARES = "Puket escolares"


class ValidationStatus(Enum):
    """Resultado técnico da comparação de texto contra o site."""
    OK = "OK"
    MISSING = "MISSING"
    INCONSISTENT = "INCONSISTENT"
    URL_NOT_FOUND = "URL_NOT_FOUND"
    API_ERROR = "API_ERROR"
    NO_EXPECTED = "NO_EXPECTED"


class CertStatus(Enum):
    """Status da certificação (renovação/encerramento)."""
    ATIVO = "ATIVO"
    ENCERRADO = "ENCERRADO"
    SKU_EXCLUIDO = "SKU_EXCLUIDO"
    EM_ANDAMENTO = "EM_ANDAMENTO"
    DESCONHECIDO = "DESCONHECIDO"


class SiteStatus(Enum):
    """Status visível no e-commerce."""
    CONFORME = "CONFORME"
    NAO_CONFORME = "NAO_CONFORME"
    PENDENTE = "PENDENTE"


class LicenseStatus(Enum):
    """Licenciamento — placeholder até a reunião de 2026-05-25."""
    ATIVO = "ATIVO"
    VENCIDO = "VENCIDO"
    NAO_APLICAVEL = "NAO_APLICAVEL"


class ComercializacaoStatus(Enum):
    """Status de comercialização — cruza certificação com prazo final de venda."""
    LIBERADA = "LIBERADA"          # ATIVO normal
    DENTRO_PRAZO = "DENTRO_PRAZO"  # encerrada, mas ainda dentro do prazo de venda
    ENCERRADA = "ENCERRADA"        # fora do prazo
    NAO_APLICA = "NAO_APLICA"      # SKU excluído / Em andamento


@dataclass
class Product:
    sku: str
    name: str
    brand: Brand
    expected_cert_text: Optional[str]
    excel_row: int
    resolved_url: Optional[str] = None
    # Campos crus da planilha
    situacao: Optional[str] = None
    tipo_certificacao: Optional[str] = None
    validade_certificacao_raw: Optional[str] = None
    prazo_final_venda_raw: Optional[str] = None
    numero_registro: Optional[str] = None
    # Enriquecimento via aba Encerramentos
    codigo_barras: Optional[str] = None
    estoque_informado: Optional[int] = None
    # Derivados
    cert_status: CertStatus = CertStatus.DESCONHECIDO
    license_status: LicenseStatus = LicenseStatus.NAO_APLICAVEL
    comercializacao_status: "ComercializacaoStatus" = ComercializacaoStatus.LIBERADA


@dataclass
class ValidationResult:
    product: Product
    status: ValidationStatus
    actual_cert_text: Optional[str] = None
    similarity_score: float = 0.0
    ai_assessment: Optional[str] = None
    error_message: Optional[str] = None
    site_status: SiteStatus = SiteStatus.PENDENTE
