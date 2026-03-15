import json
import os
from pathlib import Path
from typing import Any
from urllib import error, request

from llm_validation import LLMValidationError, TermAnalysis, validate_analysis_response

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4.1-mini"

PROMPT_TEMPLATE = """You are a linguistic analysis assistant for an English learner.

Input:
- term: an English word or phrase
- context_sentence: sentence where the term is used (optional)
- user_profile_bio: free-form user description (profession, interests, goals)
- user_level: current English level selected by user

Your task is to analyze the term and return a JSON object with linguistic information.

Core learner context:
- Learner level: {user_level}
- Relevance must prioritize what is useful for the specified learner level right now.
- Do NOT overrate advanced vocabulary that is above the selected level just because it is prestigious or nuanced.

How to calculate relevance (0-10):
Use a balanced score based on all 3 factors below:
1) General everyday frequency in modern English.
2) Practical usefulness for B1-B2 communication.
3) Personal relevance to user_profile_bio (profession/interests/goals).

Personalization rule:
- If bio indicates IT/software/engineering, increase relevance for IT-related terms.
- If bio indicates medicine/healthcare, increase relevance for medical terms.
- Apply similar logic for other domains.
- If bio is empty or vague, rely on factors (1) and (2).

Calibration rule (important):
- Be stricter with scores 8-10; reserve them for words truly common and high-value for B1-B2.
- Rare/specialized or clearly advanced C1+ words should usually be lower (often around 4-6 unless strongly needed by user bio).
- Avoid inflated scoring.

Additional rules:
1. Definition
- Provide a short English definition (max 10 words, one sentence).
- If term has multiple common meanings, include them concisely in one definition.

2. Russian translation
- Provide a short Russian translation in field "translationRu".
- It must be strictly shorter than the English definition.
- Keep it concise (usually 1-3 words) and natural.

3. Examples
- Generate natural English sentences demonstrating real usage.
- At least 2 examples.
- If term has multiple meanings, provide at least one example per meaning.
- Sentences must be clear and realistic.

4. Output format
- Return ONLY valid JSON. No explanations.

JSON structure:
{{
  "term": "<input word or phrase>",
  "relevance": <0-10>,
  "definition": "<short definition in English>",
  "translationRu": "<краткий перевод на русский>",
  "examples": [
    "<example sentence>",
    "<example sentence>"
  ]
}}

term: {term}
context_sentence: {context_sentence}
user_profile_bio: {user_bio}
user_level: {user_level}
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


def analyze_term(term: str, user_bio: str = "", user_level: str = "", context_sentence: str = "") -> TermAnalysis:
    _load_local_env()
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
        "model": os.getenv("OPENAI_MODEL", DEFAULT_MODEL),
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
