"""Configuration for the certification validation system."""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Paths
BASE_DIR = Path(__file__).parent
PROJECT_DIR = BASE_DIR.parent
EXCEL_FILE = PROJECT_DIR / "STATUS CERTIFICAÇÃO.xlsx"
REPORTS_DIR = BASE_DIR / "reports"

# Excel column mappings (1-indexed)
# Imaginarium sheet
IMAGINARIUM_COLS = {
    "status": 21,            # SITUAÇÃO
    "sku": 3,                # CÓDIGO
    "name": 6,               # NOME
    "cert_text": 22,         # Descrição E-commerce
    "tipo_cert": 8,          # TIPO DE CERTIFICAÇÃO
    "validade_cert": 14,     # Validade da Certificação
    "numero_registro": 17,   # Número Registro / Homologação
    "prazo_final_venda": 23, # Prazo Final Venda
}

# Puket sheet
PUKET_COLS = {
    "status": 20,            # SITUAÇÃO
    "sku": 3,                # CÓDIGO
    "name": 6,               # NOME
    "cert_text": 21,         # Descrição E-commerce
    "tipo_cert": 8,          # TIPO DE CERTIFICAÇÃO
    "validade_cert": 14,     # Validade da Certificação
    "numero_registro": 17,   # Número Registro / Homologação
    "prazo_final_venda": 22, # Prazo Final Venda
}

# Puket escolares sheet
PUKET_ESCOLARES_COLS = {
    "status": 7,             # STATUS
    "sku": 1,                # SKU
    "name": 2,               # NOME COMERCIAL
    "cert_text": 8,          # Descrição E-commerce
    "tipo_cert": 3,          # TIPO
    "validade_cert": None,   # Não há coluna de validade nesta aba
    "numero_registro": 5,    # REGISTRO
    "prazo_final_venda": 10, # Prazo Final Venda
}

SHEET_CONFIG = {
    "Imaginarium": IMAGINARIUM_COLS,
    "Puket": PUKET_COLS,
    "Puket escolares": PUKET_ESCOLARES_COLS,
}

# Encerramentos sheet — manual stock + EAN data maintained by the fiscal team.
# Cruzamos por SKU pra enriquecer cada Product com codigo_barras + estoque_informado.
ENCERRAMENTOS_SHEET = "Encerramentos"
ENCERRAMENTOS_COLS = {
    "sku": 2,
    "estoque_informado": 4,
    "codigo_barras": 8,
    "prazo_final_venda": 7,
}

ACTIVE_STATUS = "ativo"

# Site URLs
SITES = {
    "Imaginarium": "https://loja.imaginarium.com.br",
    "Puket": "https://www.puket.com.br",
    "Puket escolares": "https://www.puket.com.br",
}

# VTEX API endpoints
VTEX_SEARCH_API = "/api/catalog_system/pub/products/search"
VTEX_SKU_API = "/api/catalog_system/pub/products/search?fq=alternateIds_RefId:{sku}"

# Puket sitemaps
PUKET_SITEMAPS = [
    "https://www.puket.com.br/sitemap/product-0.xml",
    "https://www.puket.com.br/sitemap/product-1.xml",
    "https://www.puket.com.br/sitemap/product-2.xml",
    "https://www.puket.com.br/sitemap/product-3.xml",
]

# Rate limiting
REQUEST_DELAY = 1.5  # seconds between requests
MAX_RETRIES = 3
REQUEST_TIMEOUT = 15  # seconds
BACKOFF_FACTOR = 2.0

# Google Sheets config
GOOGLE_SHEETS_ID = os.getenv(
    "GOOGLE_SHEETS_ID",
    "1qcgcj9814UFikhurgvsTTcUxvPF2r3w_QY_EurvBtSE",
)
GOOGLE_CREDENTIALS_FILE = Path(
    os.getenv("GOOGLE_CREDENTIALS_FILE", BASE_DIR / "google-credentials.json")
)

# OpenRouter AI config (optional)
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "anthropic/claude-sonnet-4-5-20250929")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

# User agent for requests
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
