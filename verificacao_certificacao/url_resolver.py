"""Resolves product SKUs to site URLs via VTEX API and sitemaps."""

import re
import time
import xml.etree.ElementTree as ET
from typing import Dict, Optional

import requests
from rich.console import Console

from .config import (
    SITES, VTEX_SEARCH_API, PUKET_SITEMAPS,
    REQUEST_DELAY, MAX_RETRIES, REQUEST_TIMEOUT,
    BACKOFF_FACTOR, USER_AGENT,
)
from .models import Brand, Product

console = Console()


class URLResolver:
    """Resolves product SKUs to URLs using VTEX API and sitemaps."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        })
        self._puket_sitemap_index: Optional[Dict[str, str]] = None

    def _request_with_retry(self, url, params=None, accept="application/json"):
        """Make HTTP request with retries and exponential backoff."""
        headers = {"Accept": accept}
        for attempt in range(MAX_RETRIES):
            try:
                resp = self.session.get(
                    url, params=params, headers=headers,
                    timeout=REQUEST_TIMEOUT,
                )
                if resp.status_code == 429:
                    wait = BACKOFF_FACTOR ** (attempt + 1)
                    console.print(f"  [yellow]Rate limited, waiting {wait}s...[/yellow]")
                    time.sleep(wait)
                    continue
                resp.raise_for_status()
                return resp
            except requests.RequestException as e:
                if attempt < MAX_RETRIES - 1:
                    wait = BACKOFF_FACTOR ** attempt
                    time.sleep(wait)
                else:
                    raise e
        return None

    def _build_puket_sitemap_index(self):
        """Download Puket sitemaps and build SKU -> URL index."""
        if self._puket_sitemap_index is not None:
            return

        console.print("[cyan]Building Puket sitemap index...[/cyan]")
        self._puket_sitemap_index = {}

        # Regex to extract SKU from URL patterns like /slug-050403838-050403838452/p
        # The SKU is typically a 9-digit number
        sku_pattern = re.compile(r'/([^/]*?-)?(\d{6,9})(?:-\d+)?/p$')

        for sitemap_url in PUKET_SITEMAPS:
            try:
                resp = self._request_with_retry(sitemap_url, accept="application/xml")
                if not resp:
                    continue
                root = ET.fromstring(resp.content)
                ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

                for url_elem in root.findall(".//sm:url/sm:loc", ns):
                    url = url_elem.text
                    if not url or "/p" not in url:
                        continue

                    match = sku_pattern.search(url)
                    if match:
                        sku = match.group(2)
                        # Store only the first URL found for each SKU
                        if sku not in self._puket_sitemap_index:
                            self._puket_sitemap_index[sku] = url

                time.sleep(REQUEST_DELAY)
            except Exception as e:
                console.print(f"  [yellow]Warning: Failed to parse sitemap {sitemap_url}: {e}[/yellow]")

        console.print(f"  [green]Indexed {len(self._puket_sitemap_index)} URLs from sitemaps[/green]")

    def resolve_imaginarium(self, product: Product) -> Optional[str]:
        """Resolve Imaginarium product URL via VTEX API RefId lookup."""
        base = SITES["Imaginarium"]
        url = f"{base}{VTEX_SEARCH_API}"
        params = {"fq": f"alternateIds_RefId:{product.sku}"}

        try:
            resp = self._request_with_retry(url, params=params)
            if not resp:
                return None

            data = resp.json()
            if data and len(data) > 0:
                link = data[0].get("link", "")
                if link:
                    return f"{base}{link}"
                link_text = data[0].get("linkText", "")
                if link_text:
                    return f"{base}/{link_text}/p"
            return None
        except Exception:
            return None

    def resolve_puket(self, product: Product) -> Optional[str]:
        """Resolve Puket product URL using 3-tier strategy."""
        # Tier 1: Sitemap index lookup
        self._build_puket_sitemap_index()
        if product.sku in self._puket_sitemap_index:
            return self._puket_sitemap_index[product.sku]

        # Tier 2: VTEX search by name
        base = SITES["Puket"]
        url = f"{base}{VTEX_SEARCH_API}"

        try:
            params = {"ft": product.name}
            resp = self._request_with_retry(url, params=params)
            if resp:
                data = resp.json()
                for item in data:
                    prod_ref = item.get("productReference", "")
                    if prod_ref.startswith(product.sku):
                        link = item.get("link", "")
                        if link:
                            return f"{base}{link}"
                        link_text = item.get("linkText", "")
                        if link_text:
                            return f"{base}/{link_text}/p"
        except Exception:
            pass

        # Tier 3: Paginated search
        try:
            page_size = 50
            for start in range(0, 2500, page_size):
                end = start + page_size - 1
                params = {"_from": start, "_to": end}
                resp = self._request_with_retry(url, params=params)
                if not resp:
                    break
                data = resp.json()
                if not data:
                    break
                for item in data:
                    prod_ref = item.get("productReference", "")
                    if prod_ref.startswith(product.sku):
                        link = item.get("link", "")
                        if link:
                            return f"{base}{link}"
                        link_text = item.get("linkText", "")
                        if link_text:
                            return f"{base}/{link_text}/p"
                time.sleep(REQUEST_DELAY)
        except Exception:
            pass

        return None

    def resolve(self, product: Product) -> Optional[str]:
        """Resolve a product's URL based on its brand."""
        if product.brand == Brand.IMAGINARIUM:
            return self.resolve_imaginarium(product)
        else:
            return self.resolve_puket(product)
