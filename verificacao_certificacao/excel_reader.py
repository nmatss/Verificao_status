"""Reads the certification spreadsheet and returns active products."""

import warnings
from typing import List

import openpyxl

from .config import EXCEL_FILE, SHEET_CONFIG, ACTIVE_STATUS
from .models import Brand, Product

BRAND_MAP = {
    "Imaginarium": Brand.IMAGINARIUM,
    "Puket": Brand.PUKET,
    "Puket escolares": Brand.PUKET_ESCOLARES,
}


def read_products(excel_path=None, brand_filter=None) -> List[Product]:
    """Read active products from the Excel spreadsheet.

    Args:
        excel_path: Path to Excel file. Defaults to configured path.
        brand_filter: Optional Brand enum to filter by.

    Returns:
        List of active Product instances.
    """
    path = excel_path or EXCEL_FILE

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        wb = openpyxl.load_workbook(str(path), data_only=True)

    products: List[Product] = []

    for sheet_name, cols in SHEET_CONFIG.items():
        brand = BRAND_MAP[sheet_name]

        if brand_filter and brand != brand_filter:
            # If filtering by "puket", include both Puket and Puket escolares
            if brand_filter == Brand.PUKET and brand == Brand.PUKET_ESCOLARES:
                pass
            elif brand_filter == Brand.PUKET_ESCOLARES and brand == Brand.PUKET:
                pass
            else:
                continue

        ws = wb[sheet_name]

        for row_idx in range(2, ws.max_row + 1):
            status_val = ws.cell(row=row_idx, column=cols["status"]).value
            if not status_val:
                continue
            if str(status_val).strip().lower() != ACTIVE_STATUS:
                continue

            sku = ws.cell(row=row_idx, column=cols["sku"]).value
            if not sku:
                continue  # Skip header/family rows without SKU

            sku = str(sku).strip()
            name = ws.cell(row=row_idx, column=cols["name"]).value
            name = str(name).strip() if name else ""
            cert_text = ws.cell(row=row_idx, column=cols["cert_text"]).value
            cert_text = str(cert_text).strip() if cert_text else None

            products.append(Product(
                sku=sku,
                name=name,
                brand=brand,
                expected_cert_text=cert_text,
                excel_row=row_idx,
            ))

    wb.close()
    return products
