"""Funções puras de derivação de status de certificação.

Sem dependências externas — somente stdlib. Lê valores brutos da planilha
(situação, prazo final venda, validade, tipo de certificação) e devolve os
enums derivados (CertStatus / SiteStatus / LicenseStatus).
"""

from __future__ import annotations

import datetime as _dt
import re
from typing import Any, Optional

from .models import (
    CertStatus,
    ComercializacaoStatus,
    LicenseStatus,
    SiteStatus,
    ValidationStatus,
)


# ---------- Parsers ----------

# Padrões aceitos para parsing manual de datas em strings.
_DATE_PATTERNS = (
    "%d/%m/%Y",
    "%d/%m/%y",
    "%Y-%m-%d",
    "%d-%m-%Y",
)


def _coerce_date(value: Any) -> Optional[_dt.date]:
    """Tenta converter qualquer valor em datetime.date. None se não der."""
    if value is None:
        return None
    if isinstance(value, _dt.datetime):
        return value.date()
    if isinstance(value, _dt.date):
        return value
    if isinstance(value, (int, float)):
        # openpyxl pode devolver float quando data_only=False; ignoramos.
        return None
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        for fmt in _DATE_PATTERNS:
            try:
                return _dt.datetime.strptime(s, fmt).date()
            except ValueError:
                continue
    return None


def _parse_generic(raw: Any) -> dict:
    """Lógica compartilhada por parse_prazo e parse_validade."""
    if raw is None:
        return {"kind": "desconhecido", "date": None}

    dt = _coerce_date(raw)
    if dt is not None:
        return {"kind": "date", "date": dt}

    if not isinstance(raw, str):
        return {"kind": "desconhecido", "date": None}

    s = raw.strip().lower()
    if not s:
        return {"kind": "desconhecido", "date": None}

    if s in {"ativo", "ativa", "vigente"}:
        return {"kind": "ativo", "date": None}
    if s in {"vencido", "vencida", "expirado", "expirada"}:
        return {"kind": "vencido", "date": None}
    if "final do lote" in s or s == "lote":
        return {"kind": "lote", "date": None}
    if s in {"n/a", "na", "não se aplica", "nao se aplica", "n.a.", "-"}:
        return {"kind": "n/a", "date": None}

    return {"kind": "desconhecido", "date": None}


def parse_prazo(raw: Any) -> dict:
    """Parse do campo "Prazo Final Venda".

    Retorna dict {"kind": <str>, "date": <date|None>} onde kind ∈
    {"date", "ativo", "vencido", "lote", "desconhecido"}.
    """
    return _parse_generic(raw)


def parse_validade(raw: Any) -> dict:
    """Parse do campo "Validade da Certificação".

    Retorna dict {"kind": <str>, "date": <date|None>}. Igual a parse_prazo
    com o adicional do kind "n/a".
    """
    return _parse_generic(raw)


# ---------- Derivações ----------

def _normalize_situacao(situacao: Optional[str]) -> str:
    if not situacao:
        return ""
    return str(situacao).strip().lower()


def derive_cert_status(situacao: Optional[str], prazo_final_venda: Any) -> CertStatus:
    """Deriva CertStatus a partir da SITUAÇÃO bruta + prazo final de venda.

    SKU excluído → SKU_EXCLUIDO; Em andamento → EM_ANDAMENTO; Ativo → ATIVO.
    Encerrado: depende do prazo (vencido → ENCERRADO; ativo/lote/data futura → ATIVO).
    """
    s = _normalize_situacao(situacao)

    if "exclu" in s:  # "SKU excluído"
        return CertStatus.SKU_EXCLUIDO
    if "andamento" in s:
        return CertStatus.EM_ANDAMENTO
    if s == "ativo":
        return CertStatus.ATIVO

    if "encerrad" in s:
        prazo = parse_prazo(prazo_final_venda)
        kind = prazo["kind"]
        if kind == "vencido":
            return CertStatus.ENCERRADO
        if kind in ("ativo", "lote"):
            return CertStatus.ATIVO
        if kind == "date" and prazo["date"] is not None:
            if prazo["date"] >= _dt.date.today():
                return CertStatus.ATIVO
            return CertStatus.ENCERRADO
        # vazio/desconhecido → fallback conservador
        return CertStatus.ENCERRADO

    return CertStatus.DESCONHECIDO


def derive_site_status(
    validation_status: Optional[ValidationStatus],
    cert_status: CertStatus,
    expected_cert_text: Optional[str],
    tipo_certificacao: Optional[str] = None,
) -> SiteStatus:
    """Cruza o status técnico da comparação com o cert_status para gerar SiteStatus.

    Args:
        validation_status: status técnico da comparação (None = nunca validado).
        cert_status: status derivado da SITUAÇÃO + prazo.
        expected_cert_text: texto esperado conforme cadastro.
        tipo_certificacao: tipo bruto da planilha — usado pra inferir
            regulado (INMETRO/ANATEL/MAPA) quando a frase esperada está vazia.

    Regras-chave:
        - validation_status is None → PENDENTE (nunca validamos contra o site).
        - NO_EXPECTED + cert ATIVO + tipo regulado → NAO_CONFORME (cadastro incompleto).
        - NO_EXPECTED + sem texto esperado → PENDENTE.
    """
    # Nunca rodou contra o site → não dá pra afirmar conformidade.
    if validation_status is None:
        return SiteStatus.PENDENTE

    # Frase esperada ausente em produto certificado regulado = cadastro incompleto
    # (Carla: "frase obrigatória ausente OU com erro = não conforme").
    if (
        validation_status == ValidationStatus.NO_EXPECTED
        and not expected_cert_text
        and cert_status == CertStatus.ATIVO
        and _tipo_mentions_regulated(tipo_certificacao)
    ):
        return SiteStatus.NAO_CONFORME

    # NO_EXPECTED + sem texto esperado (não regulado) → pendente — planilha incompleta.
    if validation_status == ValidationStatus.NO_EXPECTED and not expected_cert_text:
        return SiteStatus.PENDENTE

    # "Encontrado no site" = a comparação técnica conseguiu olhar a página.
    found_on_site = validation_status not in (
        ValidationStatus.URL_NOT_FOUND,
        ValidationStatus.NO_EXPECTED,
    )

    if cert_status in (CertStatus.SKU_EXCLUIDO, CertStatus.ENCERRADO):
        return SiteStatus.NAO_CONFORME if found_on_site else SiteStatus.CONFORME

    if cert_status == CertStatus.ATIVO:
        if validation_status == ValidationStatus.URL_NOT_FOUND:
            return SiteStatus.CONFORME
        if validation_status == ValidationStatus.OK:
            return SiteStatus.CONFORME
        if not found_on_site:
            return SiteStatus.CONFORME
        # MISSING / INCONSISTENT / API_ERROR
        return SiteStatus.NAO_CONFORME

    # EM_ANDAMENTO ou DESCONHECIDO
    return SiteStatus.PENDENTE


def _tipo_mentions_regulated(tipo: Optional[str]) -> bool:
    if not tipo:
        return False
    up = str(tipo).upper()
    return any(k in up for k in ("INMETRO", "ANATEL", "MAPA"))


def derive_license_status(
    tipo_certificacao: Optional[str],
    validade_certificacao: Any,
    today: Optional[_dt.date] = None,
) -> LicenseStatus:
    """Placeholder de licenciamento até definição final (reunião 2026-05-25).

    Hoje: se o tipo não menciona INMETRO/ANATEL/MAPA → NAO_APLICAVEL.
    Caso contrário, baseia-se na validade (data passada → VENCIDO; resto → ATIVO).
    """
    if not _tipo_mentions_regulated(tipo_certificacao):
        return LicenseStatus.NAO_APLICAVEL

    today = today or _dt.date.today()
    validade = parse_validade(validade_certificacao)
    kind = validade["kind"]

    if kind == "date" and validade["date"] is not None:
        return LicenseStatus.ATIVO if validade["date"] >= today else LicenseStatus.VENCIDO
    if kind == "vencido":
        return LicenseStatus.VENCIDO
    if kind in ("ativo", "lote"):
        return LicenseStatus.ATIVO
    if kind == "n/a":
        return LicenseStatus.NAO_APLICAVEL

    # desconhecido / vazio → ATIVO conservador (não bloquear) — refinar na reunião.
    return LicenseStatus.ATIVO


def derive_comercializacao_status(
    cert_status: CertStatus,
    situacao: Optional[str],
    prazo_final_venda: Any,
    today: Optional[_dt.date] = None,
) -> ComercializacaoStatus:
    """Deriva o status de comercialização cruzando cert_status + situação + prazo.

    Regras:
        - SKU_EXCLUIDO ou EM_ANDAMENTO → NAO_APLICA
        - cert ATIVO + situacao=Ativo → LIBERADA
        - cert ATIVO + situacao=Encerrado (ou prazo ainda vigente) → DENTRO_PRAZO
        - cert ENCERRADO → ENCERRADA
        - default (DESCONHECIDO etc.) → NAO_APLICA
    """
    if cert_status in (CertStatus.SKU_EXCLUIDO, CertStatus.EM_ANDAMENTO):
        return ComercializacaoStatus.NAO_APLICA

    if cert_status == CertStatus.ENCERRADO:
        return ComercializacaoStatus.ENCERRADA

    if cert_status == CertStatus.ATIVO:
        s = _normalize_situacao(situacao)
        if s == "ativo":
            return ComercializacaoStatus.LIBERADA
        if "encerrad" in s:
            # cert_status ATIVO + situação encerrada = certificação vencida mas
            # ainda dentro do prazo final de venda.
            return ComercializacaoStatus.DENTRO_PRAZO
        # Fallback: cert ATIVO sem situação clara — checar prazo
        prazo = parse_prazo(prazo_final_venda)
        if prazo["kind"] == "date" and prazo["date"] is not None:
            today = today or _dt.date.today()
            if prazo["date"] >= today:
                return ComercializacaoStatus.DENTRO_PRAZO
            return ComercializacaoStatus.ENCERRADA
        if prazo["kind"] in ("ativo", "lote"):
            return ComercializacaoStatus.LIBERADA
        return ComercializacaoStatus.LIBERADA

    return ComercializacaoStatus.NAO_APLICA


# ---------- Helpers de serialização ----------

def stringify_raw(value: Any) -> Optional[str]:
    """Converte um valor cru (datetime/str/etc) para string serializável.

    Datas viram "YYYY-MM-DD"; strings ficam strip()-ed; None permanece None.
    """
    if value is None:
        return None
    if isinstance(value, _dt.datetime):
        return value.date().isoformat()
    if isinstance(value, _dt.date):
        return value.isoformat()
    s = str(value).strip()
    return s if s else None
