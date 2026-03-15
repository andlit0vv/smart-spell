import json
import os
from pathlib import Path
from typing import Any
from urllib import error, request

from llm_validation import LLMValidationError, TermAnalysis, validate_analysis_response

import httpx

OPENAI_API_URL = "https://api.openai.com/v1/responses"
DEFAULT_MODEL = "gpt-5-nano"


PROMPT_TEMPLATE = """
You analyze vocabulary for an English learner.

Input:
term: {term}
context: {context_sentence}
user_bio: {user_bio}
level: {user_level}

Return JSON only:

{{
 "term": "",
 "relevance": 0-10,
 "definition": "",
 "translationRu": "",
 "examples": ["",""]
}}

Rules:
- definition ≤10 words
- translation shorter than definition
- at least 2 natural examples
- relevance based on:
  1) frequency in modern English
  2) usefulness for B1-B2 communication
  3) match with user_bio domain
- avoid overrating rare/advanced words
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
_load_local_env()



def _extract_content(response_data):
    try:
        # Самый быстрый путь (новый Responses API)
        if "output_text" in response_data:
            text = response_data["output_text"]

            if isinstance(text, list):
                return "".join(text)

            if isinstance(text, str):
                return text

        # fallback
        for item in response_data.get("output", []):
            if item.get("type") == "message":
                for part in item.get("content", []):
                    if "text" in part:
                        return part["text"]

        raise LLMError("No text content in OpenAI response")

    except Exception:
        raise LLMError(f"Invalid OpenAI response format: {response_data}")



def analyze_term(term: str, user_bio: str = "", user_level: str = "", context_sentence: str = "") -> TermAnalysis:

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise LLMError("OPENAI_API_KEY is not set")

    prompt = PROMPT_TEMPLATE.format(
        term=term,
        user_bio=user_bio.strip() or "(empty)",
        user_level=user_level.strip() or "B1-B2",
        context_sentence=context_sentence.strip() or "(not provided)",
    )

    request_payload = {
        "model": "gpt-5-nano",
        "input": prompt,
        "max_output_tokens": 380,
        "reasoning": {"effort": "minimal"},
        "prompt_cache_key": "term-analysis-v1",
        "text": {
            "format": {"type": "json_object"},
        }
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
    if not content:
        raise LLMError(f"LLM returned empty response: {response_data}")
    try:
        analysis_payload = json.loads(content)
    except json.JSONDecodeError as exc:
        raise LLMError("LLM did not return valid JSON") from exc

    try:
        return validate_analysis_response(term, analysis_payload)
    except LLMValidationError as exc:
        raise LLMError(str(exc)) from exc
