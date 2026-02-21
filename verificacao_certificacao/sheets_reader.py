"""Reads product data directly from Google Sheets instead of Excel."""

from typing import List, Optional

import gspread

from .config import SHEET_CONFIG, ACTIVE_STATUS, GOOGLE_SHEETS_ID, GOOGLE_CREDENTIALS_FILE
from .models import Brand, Product

BRAND_MAP = {
    "Imaginarium": Brand.IMAGINARIUM,
    "Puket": Brand.PUKET,
    "Puket escolares": Brand.PUKET_ESCOLARES,
}


def read_products_from_sheets(
    spreadsheet_id: Optional[str] = None,
    credentials_file: Optional[str] = None,
    brand_filter: Optional[Brand] = None,
) -> List[Product]:
    """Read active products from Google Sheets.

    Args:
        spreadsheet_id: Google Sheets ID. Defaults to configured ID.
        credentials_file: Path to service account JSON. Defaults to configured path.
        brand_filter: Optional Brand enum to filter by.

    Returns:
        List of active Product instances.
    """
    sheet_id = spreadsheet_id or GOOGLE_SHEETS_ID
    creds_file = credentials_file or GOOGLE_CREDENTIALS_FILE

    gc = gspread.service_account(filename=str(creds_file))
    spreadsheet = gc.open_by_key(sheet_id)

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
            # row is 0-indexed list, cols are 1-indexed
            status_val = _get_cell(row, cols["status"])
            if not status_val:
                continue
            if status_val.strip().lower() != ACTIVE_STATUS:
                continue

            sku = _get_cell(row, cols["sku"])
            if not sku:
                continue  # Skip header/family rows without SKU

            sku = sku.strip()
            name = _get_cell(row, cols["name"])
            name = name.strip() if name else ""
            cert_text = _get_cell(row, cols["cert_text"])
            cert_text = cert_text.strip() if cert_text else None

            products.append(Product(
                sku=sku,
                name=name,
                brand=brand,
                expected_cert_text=cert_text,
                excel_row=row_idx,
            ))

    return products


def _get_cell(row: list, col_index: int) -> Optional[str]:
    """Get cell value from row list using 1-indexed column number."""
    idx = col_index - 1
    if idx < 0 or idx >= len(row):
        return None
    val = row[idx]
    return val if val else None
