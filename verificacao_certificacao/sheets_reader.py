"""Reads product data directly from Google Sheets instead of Excel."""

import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import gspread

from .cert_rules import (
    derive_cert_status,
    derive_comercializacao_status,
    derive_license_status,
    stringify_raw,
)
from .config import (
    ENCERRAMENTOS_COLS,
    ENCERRAMENTOS_SHEET,
    GOOGLE_CREDENTIALS_FILE,
    GOOGLE_SHEETS_ID,
    SHEET_CONFIG,
)
from .models import Brand, Product

logger = logging.getLogger(__name__)

BRAND_MAP = {
    "Imaginarium": Brand.IMAGINARIUM,
    "Puket": Brand.PUKET,
    "Puket escolares": Brand.PUKET_ESCOLARES,
}

# Sheets não tem mtime estável → usamos TTL de 60s pra cache.
_CACHE_TTL_SECS = 60.0
_CACHE: Dict[Tuple[str, Any], Tuple[float, List[Product]]] = {}


def _coerce_estoque_str(value: Optional[str]) -> Optional[int]:
    """Converte string vinda do Google Sheets em int (estoque). None se vazio."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        return int(float(s.replace(",", ".")))
    except (ValueError, OverflowError):
        return None


def _coerce_ean_str(value: Optional[str]) -> Optional[str]:
    """Limpa o EAN vindo do Google Sheets (remove .0 trailing se houver)."""
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    # Google Sheets pode devolver "7898458230185.0" se o cell type for número.
    if s.endswith(".0"):
        try:
            return str(int(float(s)))
        except (ValueError, OverflowError):
            return s
    try:
        # Se for um número puro, garante que volta como inteiro string.
        return str(int(float(s))) if "." in s else s
    except (ValueError, OverflowError):
        return s


def _read_encerramentos_sheets(spreadsheet) -> Dict[str, Dict[str, Any]]:
    """Lê a aba Encerramentos do Google Sheets e devolve mapa por SKU.

    Se a aba não existir, loga warning e retorna dict vazio.
    """
    try:
        ws = spreadsheet.worksheet(ENCERRAMENTOS_SHEET)
    except gspread.exceptions.WorksheetNotFound:
        logger.warning(
            "Aba '%s' não encontrada no Google Sheets — produtos ficarão sem "
            "EAN/estoque enriquecido.",
            ENCERRAMENTOS_SHEET,
        )
        return {}

    all_values = ws.get_all_values()
    out: Dict[str, Dict[str, Any]] = {}

    prazo_col = ENCERRAMENTOS_COLS.get("prazo_final_venda")

    for row in all_values[1:]:
        sku = _get_cell(row, ENCERRAMENTOS_COLS["sku"])
        if not sku:
            continue
        sku = sku.strip()
        if not sku:
            continue

        ean_raw = _get_cell(row, ENCERRAMENTOS_COLS["codigo_barras"])
        estoque_raw = _get_cell(row, ENCERRAMENTOS_COLS["estoque_informado"])
        prazo_raw = _get_cell(row, prazo_col) if prazo_col else None

        out[sku] = {
            "codigo_barras": _coerce_ean_str(ean_raw),
            "estoque_informado": _coerce_estoque_str(estoque_raw),
            "prazo_final_venda_raw": prazo_raw,
        }

    return out


def read_products_from_sheets(
    spreadsheet_id: Optional[str] = None,
    credentials_file: Optional[str] = None,
    brand_filter: Optional[Brand] = None,
) -> List[Product]:
    """Read all products from Google Sheets (independent of situação).

    Args:
        spreadsheet_id: Google Sheets ID. Defaults to configured ID.
        credentials_file: Path to service account JSON. Defaults to configured path.
        brand_filter: Optional Brand enum to filter by.

    Returns:
        List of Product instances (all situações).
    """
    sheet_id = spreadsheet_id or GOOGLE_SHEETS_ID
    creds_file = credentials_file or GOOGLE_CREDENTIALS_FILE

    cache_key = (str(sheet_id), brand_filter)
    cached = _CACHE.get(cache_key)
    if cached is not None:
        stored_at, prods = cached
        if (time.time() - stored_at) <= _CACHE_TTL_SECS:
            return prods

    gc = gspread.service_account(filename=str(creds_file))
    spreadsheet = gc.open_by_key(sheet_id)

    # Lê o mapa de Encerramentos uma vez só
    encerramentos_map = _read_encerramentos_sheets(spreadsheet)

    products: List[Product] = []

    for sheet_name, cols in SHEET_CONFIG.items():
        brand = BRAND_MAP[sheet_name]

        if brand_filter and brand != brand_filter:
            if brand_filter == Brand.PUKET and brand == Brand.PUKET_ESCOLARES:
                pass
            elif brand_filter == Brand.PUKET_ESCOLARES and brand == Brand.PUKET:
                pass
            else:
                continue

        try:
            ws = spreadsheet.worksheet(sheet_name)
        except gspread.exceptions.WorksheetNotFound:
            continue

        # Get all values at once (much faster than cell-by-cell)
        all_values = ws.get_all_values()

        # Skip header row (index 0)
        for row_idx, row in enumerate(all_values[1:], start=2):
            sku = _get_cell(row, cols["sku"])
            if not sku:
                continue  # Skip header/family rows without SKU

            sku = sku.strip()
            if not sku:
                continue

            name = _get_cell(row, cols["name"])
            name = name.strip() if name else ""

            cert_text = _get_cell(row, cols["cert_text"])
            cert_text = cert_text.strip() if cert_text else None

            situacao_raw = _get_cell(row, cols.get("status"))
            situacao = stringify_raw(situacao_raw)

            tipo_raw = _get_cell(row, cols.get("tipo_cert"))
            tipo_cert = stringify_raw(tipo_raw)

            validade_raw = _get_cell(row, cols.get("validade_cert"))
            validade_str = stringify_raw(validade_raw)

            prazo_raw = _get_cell(row, cols.get("prazo_final_venda"))
            prazo_str_marca = stringify_raw(prazo_raw)

            numero_raw = _get_cell(row, cols.get("numero_registro"))
            numero_registro = stringify_raw(numero_raw)

            # Merge enriquecimento da aba Encerramentos (por SKU)
            extra = encerramentos_map.get(sku, {})
            codigo_barras = extra.get("codigo_barras")
            estoque_informado = extra.get("estoque_informado")
            prazo_encerramentos_raw = extra.get("prazo_final_venda_raw")
            prazo_encerramentos_str = stringify_raw(prazo_encerramentos_raw)

            # Prioriza Encerramentos (mantido pela fiscal); senão usa o da aba da marca
            if prazo_encerramentos_str:
                prazo_effective_raw = prazo_encerramentos_raw
                prazo_str_final = prazo_encerramentos_str
            else:
                prazo_effective_raw = prazo_raw
                prazo_str_final = prazo_str_marca

            # Deriva DEPOIS do merge — prazo influencia cert_status/comercializacao
            cert_status = derive_cert_status(situacao, prazo_effective_raw)
            license_status = derive_license_status(tipo_cert, validade_raw)
            comercializacao_status = derive_comercializacao_status(
                cert_status, situacao, prazo_effective_raw
            )

            products.append(Product(
                sku=sku,
                name=name,
                brand=brand,
                expected_cert_text=cert_text,
                excel_row=row_idx,
                situacao=situacao,
                tipo_certificacao=tipo_cert,
                validade_certificacao_raw=validade_str,
                prazo_final_venda_raw=prazo_str_final,
                numero_registro=numero_registro,
                codigo_barras=codigo_barras,
                estoque_informado=estoque_informado,
                cert_status=cert_status,
                license_status=license_status,
                comercializacao_status=comercializacao_status,
            ))

    _CACHE[cache_key] = (time.time(), products)
    return products


def _get_cell(row: list, col_index: Optional[int]) -> Optional[str]:
    """Get cell value from row list using 1-indexed column number."""
    if col_index is None:
        return None
    idx = col_index - 1
    if idx < 0 or idx >= len(row):
        return None
    val = row[idx]
    return val if val else None
