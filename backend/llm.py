import json
import os
from pathlib import Path
from typing import Any
from urllib import error, request

from llm_validation import LLMValidationError, TermAnalysis, validate_analysis_response

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4.1-mini"

PROMPT_TEMPLATE = """You are a linguistic analysis assistant.

Input: an English word or phrase.

Your task is to analyze it and return a JSON object with linguistic information.

Rules:

1. Definition
- Provide a short English definition (max 10 words, one sentence).
- If the word/phrase has multiple common meanings, include them concisely in one definition.

2. Relevance score (0–10)
Estimate how frequently the word/phrase is used in modern English (2026 context).

Use this scale:
0–1 → obsolete or almost never used
2–3 → very rare or narrow technical usage (e.g., medical/legal jargon)
4–5 → uncommon but still known
6–7 → moderately common
8–9 → very common in everyday language
10 → extremely common across contexts

3. Examples
Generate natural English sentences demonstrating real usage.

Rules for examples:
- At least 2 examples.
- If the word/phrase has multiple meanings, provide at least one example per meaning.
- Sentences must be clear and realistic.

4. Output format
Return ONLY valid JSON. No explanations.

JSON structure:

{
  "term": "<input word or phrase>",
  "relevance": <0-10>,
  "definition": "<short definition in English>",
  "examples": [
    "<example sentence>",
    "<example sentence>"
  ]
}

Term: {term}
"""


class LLMError(Exception):
    pass


def _load_local_env() -> None:
    backend_dir = Path(__file__).resolve().parent
    for candidate in (backend_dir / ".env", backend_dir.parent / ".env"):
        if not candidate.exists():
            continue

        for line in candidate.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue

            key, value = stripped.split("=", 1)
            env_key = key.strip()
            env_value = value.strip().strip('"').strip("'")
            os.environ.setdefault(env_key, env_value)


def _extract_content(response_data: dict[str, Any]) -> str:
    choices = response_data.get("choices") or []
    if not choices:
        raise LLMError("OpenAI response has no choices")

    message = choices[0].get("message") or {}
    content = message.get("content")
    if not content:
        raise LLMError("OpenAI response has empty content")

    return content


def analyze_term(term: str) -> TermAnalysis:
    _load_local_env()
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise LLMError("OPENAI_API_KEY is not set")

    prompt = PROMPT_TEMPLATE.format(term=term)

    request_payload = {
        "model": os.getenv("OPENAI_MODEL", DEFAULT_MODEL),
        "temperature": 0.2,
        "messages": [
            {
                "role": "user",
                "content": prompt,
            }
        ],
        "response_format": {"type": "json_object"},
    }

    req = request.Request(
        OPENAI_API_URL,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        data=json.dumps(request_payload).encode("utf-8"),
    )

    try:
        with request.urlopen(req, timeout=40) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise LLMError(f"OpenAI HTTP error {exc.code}: {details}") from exc
    except error.URLError as exc:
        raise LLMError(f"OpenAI connection error: {exc.reason}") from exc
    except TimeoutError as exc:
        raise LLMError("OpenAI request timed out") from exc

    content = _extract_content(response_data)

    try:
        analysis_payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise LLMError("LLM did not return valid JSON") from exc

    try:
        return validate_analysis_response(term, analysis_payload)
    except LLMValidationError as exc:
        raise LLMError(str(exc)) from exc
