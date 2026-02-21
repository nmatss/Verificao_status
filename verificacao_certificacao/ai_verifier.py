"""Optional AI-based verification via OpenRouter for INCONSISTENT results."""

from typing import Optional, Tuple

import requests

from .config import OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_BASE_URL


def verify_with_ai(expected: str, actual: str) -> Tuple[bool, float, str]:
    """Use LLM to semantically compare certification texts.

    Args:
        expected: Expected certification text from spreadsheet.
        actual: Actual certification text found on site.

    Returns:
        Tuple of (is_match, confidence, explanation).

    Raises:
        RuntimeError: If OpenRouter API key is not configured.
    """
    if not OPENROUTER_API_KEY:
        raise RuntimeError(
            "OpenRouter API key not configured. "
            "Set OPENROUTER_API_KEY in .env file."
        )

    prompt = f"""Compare these two product certification texts and determine if they refer to the same certification.

EXPECTED TEXT (from spreadsheet):
{expected}

ACTUAL TEXT (from website):
{actual}

Analyze whether:
1. They reference the same certification body (INMETRO, ANATEL, etc.)
2. The registration/homologation numbers match
3. The OCP numbers match (if present)
4. Minor differences in formatting or wording should be tolerated

Respond EXACTLY in this format (3 lines):
MATCH: true/false
CONFIDENCE: 0.0-1.0
EXPLANATION: brief explanation"""

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 200,
        "temperature": 0.0,
    }

    try:
        resp = requests.post(
            OPENROUTER_BASE_URL,
            headers=headers,
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        content = data["choices"][0]["message"]["content"].strip()
        return _parse_ai_response(content)

    except Exception as e:
        return False, 0.0, f"AI verification failed: {e}"


def _parse_ai_response(text: str) -> Tuple[bool, float, str]:
    """Parse the structured AI response."""
    lines = text.strip().split("\n")

    is_match = False
    confidence = 0.0
    explanation = ""

    for line in lines:
        line = line.strip()
        if line.upper().startswith("MATCH:"):
            val = line.split(":", 1)[1].strip().lower()
            is_match = val in ("true", "yes", "sim")
        elif line.upper().startswith("CONFIDENCE:"):
            try:
                confidence = float(line.split(":", 1)[1].strip())
            except ValueError:
                confidence = 0.5
        elif line.upper().startswith("EXPLANATION:"):
            explanation = line.split(":", 1)[1].strip()

    if not explanation:
        explanation = text

    return is_match, confidence, explanation


def is_ai_available() -> bool:
    """Check if AI verification is available (API key configured)."""
    return bool(OPENROUTER_API_KEY)
