"""VTEX API client for fetching product descriptions."""

import re
import time
from typing import Optional, Tuple

import requests
from rich.console import Console

from .config import (
    SITES, VTEX_SEARCH_API,
    MAX_RETRIES, REQUEST_TIMEOUT, BACKOFF_FACTOR, USER_AGENT,
)
from .models import Brand, Product

console = Console()

# Patterns to identify certification text within descriptions
CERT_PATTERNS = [
    re.compile(r'Certificação\s+INMETRO\s*:.*', re.IGNORECASE | re.DOTALL),
    re.compile(r'Este\s+produto\s+está\s+homologado\s+pela\s+Anatel.*', re.IGNORECASE | re.DOTALL),
    re.compile(r'Este\s+produto\s+contém\s+a\s+placa\s+\S+.*?homologação.*', re.IGNORECASE | re.DOTALL),
    re.compile(r'Produto\s+certificado\s+por\s+.*', re.IGNORECASE | re.DOTALL),
]


def clean_html(text: str) -> str:
    """Remove HTML tags and normalize whitespace."""
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace('&nbsp;', ' ')
    text = text.replace('&amp;', '&')
    text = text.replace('&lt;', '<')
    text = text.replace('&gt;', '>')
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def extract_cert_text(description: str) -> Optional[str]:
    """Extract certification text from a product description."""
    cleaned = clean_html(description)

    for pattern in CERT_PATTERNS:
        match = pattern.search(cleaned)
        if match:
            return match.group(0).strip()

    return None


class VTEXScraper:
    """Client for VTEX catalog API to fetch product descriptions."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        })

    def _request_with_retry(self, url, params=None):
        """Make HTTP request with retries and exponential backoff."""
        for attempt in range(MAX_RETRIES):
            try:
                resp = self.session.get(
                    url, params=params, timeout=REQUEST_TIMEOUT,
                )
                if resp.status_code == 429:
                    wait = BACKOFF_FACTOR ** (attempt + 1)
                    time.sleep(wait)
                    continue
                if resp.status_code == 404:
                    return None
                if resp.status_code == 400:
                    return None
                resp.raise_for_status()
                return resp
            except requests.RequestException:
                if attempt < MAX_RETRIES - 1:
                    wait = BACKOFF_FACTOR ** attempt
                    time.sleep(wait)
                else:
                    return None
        return None

    def _extract_from_item(self, item: dict, product: Product) -> Tuple[Optional[str], Optional[str]]:
        """Extract description and cert text from a VTEX API product item."""
        description = item.get("description", "")

        if not description:
            description = item.get("metaTagDescription", "")

        # For Imaginarium marketplace products, check specifications
        if product.brand == Brand.IMAGINARIUM and not extract_cert_text(description or ""):
            specs = item.get("allSpecifications", [])
            for spec_name in specs:
                spec_values = item.get(spec_name, [])
                if "certificação" in spec_name.lower() or "inmetro" in spec_name.lower():
                    if spec_values:
                        cert_from_spec = " ".join(str(v) for v in spec_values)
                        return description, cert_from_spec

        # Store resolved URL if available
        if not product.resolved_url:
            link = item.get("link", "")
            if link:
                product.resolved_url = link

        if not description:
            return "", None

        cert_text = extract_cert_text(description)
        return description, cert_text

    def fetch_product_description(self, product: Product) -> Tuple[Optional[str], Optional[str]]:
        """Fetch product description from VTEX API.

        Strategy by brand:
        - Imaginarium: direct RefId lookup (SKU is the RefId)
        - Puket: search by name terms, match by productReference prefix

        Returns:
            Tuple of (full_description, extracted_cert_text).
            Returns (None, None) on error.
        """
        if product.brand == Brand.IMAGINARIUM:
            return self._fetch_imaginarium(product)
        else:
            return self._fetch_puket(product)

    def _fetch_imaginarium(self, product: Product) -> Tuple[Optional[str], Optional[str]]:
        """Fetch Imaginarium product via RefId lookup."""
        base = SITES["Imaginarium"]
        url = f"{base}{VTEX_SEARCH_API}"
        params = {"fq": f"alternateIds_RefId:{product.sku}"}

        resp = self._request_with_retry(url, params=params)
        if not resp:
            return None, None

        try:
            data = resp.json()
        except ValueError:
            return None, None

        if not data:
            return None, None

        return self._extract_from_item(data[0], product)

    def _fetch_puket(self, product: Product) -> Tuple[Optional[str], Optional[str]]:
        """Fetch Puket product using multiple search strategies.

        The Excel SKU (e.g., 100400440) is a prefix of the VTEX productReference
        (e.g., 100400440452). We try multiple strategies:
        1. Search by product name terms
        2. Search by SKU as text term
        3. Paginated browse with prefix matching
        """
        base = SITES["Puket"]
        url = f"{base}{VTEX_SEARCH_API}"

        # Strategy 1: Search by product name words (via URL path)
        # This is the most reliable for Puket
        search_terms = self._build_search_terms(product.name)
        if search_terms:
            search_url = f"{url}/{search_terms}"
            resp = self._request_with_retry(search_url)
            if resp:
                try:
                    data = resp.json()
                    matched = self._match_by_sku_prefix(data, product.sku)
                    if matched:
                        return self._extract_from_item(matched, product)
                except ValueError:
                    pass

        # Strategy 2: Search by SKU digits as text (in URL path)
        search_url = f"{url}/{product.sku}"
        resp = self._request_with_retry(search_url)
        if resp:
            try:
                data = resp.json()
                if data:
                    matched = self._match_by_sku_prefix(data, product.sku)
                    if matched:
                        return self._extract_from_item(matched, product)
            except ValueError:
                pass

        # Strategy 3: Search with shorter name (first 2-3 significant words)
        short_terms = self._build_short_search(product.name)
        if short_terms and short_terms != search_terms:
            search_url = f"{url}/{short_terms}"
            resp = self._request_with_retry(search_url)
            if resp:
                try:
                    data = resp.json()
                    matched = self._match_by_sku_prefix(data, product.sku)
                    if matched:
                        return self._extract_from_item(matched, product)
                except ValueError:
                    pass

        return None, None

    def _build_search_terms(self, name: str) -> str:
        """Build URL-safe search terms from product name."""
        # Remove very short words and common Portuguese articles
        stopwords = {"de", "do", "da", "dos", "das", "em", "com", "e", "o", "a", "os", "as",
                      "por", "para", "um", "uma", "uns", "umas", "no", "na", "nos", "nas"}
        words = name.lower().split()
        terms = [w for w in words if w not in stopwords and len(w) > 1]
        # Use first 4 significant words to avoid 400 errors
        return "%20".join(terms[:4])

    def _build_short_search(self, name: str) -> str:
        """Build a shorter search query using just 2 key words."""
        stopwords = {"de", "do", "da", "dos", "das", "em", "com", "e", "o", "a", "os", "as",
                      "por", "para", "um", "uma", "uns", "umas", "no", "na", "nos", "nas",
                      "menina", "menino", "teen", "bebe", "bebê", "infantil"}
        words = name.lower().split()
        terms = [w for w in words if w not in stopwords and len(w) > 2]
        return "%20".join(terms[:2])

    def _match_by_sku_prefix(self, data: list, sku: str) -> Optional[dict]:
        """Find the product whose productReference starts with the given SKU."""
        for item in data:
            prod_ref = item.get("productReference", "")
            if prod_ref.startswith(sku):
                return item
        return None
