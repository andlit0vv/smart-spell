import json
import os
from pathlib import Path
from typing import Any
from urllib import error, request

from flask import jsonify, request as flask_request

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4.1-mini"
DEFAULT_WORDS_PER_TERM = 15

READING_PROMPT_TEMPLATE = """You are an assistant that generates short learning texts for English learners.

Input:
- target_words: {target_words}
- allow_word_forms: {allow_word_forms}
- words_per_term: {words_per_term}

Task:
Generate a natural English text that includes ALL target words.

Rules:

1. The total length of the text must be:
   total_words = len(target_words) × words_per_term

2. Every target word MUST appear at least once in the text.

3. If allow_word_forms = true:
   - you may use different grammatical forms of the words
   (plural, verb tenses, derived forms, etc.)

4. If allow_word_forms = false:
   - use the exact target words as written
   - do not change their grammatical form

5. The text must:
   - sound natural
   - be coherent
   - be understandable for an English learner
   - avoid unnecessary complexity

6. Do NOT list the words separately.
   They must appear naturally inside the text.

7. Keep the word count as close as possible to the required total.

Output format:
Return JSON only:
{{
  "text": "<generated text>"
}}
"""


class ReadingLLMError(Exception):
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
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _call_llm(prompt: str) -> dict[str, Any]:
    _load_local_env()
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ReadingLLMError("OPENAI_API_KEY is not set")

    req = request.Request(
        OPENAI_API_URL,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        data=json.dumps(
            {
                "model": os.getenv("OPENAI_MODEL", DEFAULT_MODEL),
                "temperature": 0.7,
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
            }
        ).encode("utf-8"),
    )

    try:
        with request.urlopen(req, timeout=40) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise ReadingLLMError(f"OpenAI HTTP error {exc.code}: {details}") from exc
    except error.URLError as exc:
        raise ReadingLLMError(f"OpenAI connection error: {exc.reason}") from exc
    except TimeoutError as exc:
        raise ReadingLLMError("OpenAI request timed out") from exc

    choices = payload.get("choices") or []
    if not choices:
        raise ReadingLLMError("OpenAI response has no choices")

    message = choices[0].get("message") or {}
    content = message.get("content")
    if not content:
        raise ReadingLLMError("OpenAI response has empty content")

    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise ReadingLLMError("LLM did not return valid JSON") from exc


def _normalize_target_words(target_words: Any) -> list[str]:
    if not isinstance(target_words, list):
        return []

    unique_words: list[str] = []
    seen = set()
    for item in target_words:
        word = str(item).strip()
        if not word:
            continue
        key = word.lower()
        if key in seen:
            continue
        seen.add(key)
        unique_words.append(word)
    return unique_words


def _fallback_text(target_words: list[str], words_per_term: int) -> str:
    target_count = max(len(target_words) * words_per_term, len(target_words))
    seed = " ".join(target_words)
    text = (
        f"In today\'s lesson, we practice {seed} in a short story. "
        "A student reads, repeats each term, and writes simple examples to remember them."
    )
    words = text.split()
    if len(words) >= target_count:
        return " ".join(words[:target_count])

    fill = "The learner stays focused and reviews the text again with confidence."
    while len(words) < target_count:
        words.extend(fill.split())
    return " ".join(words[:target_count])


def register_reading_endpoints(app):
    @app.post("/api/reading/generate")
    def reading_generate():
        data = flask_request.get_json(silent=True) or {}
        target_words = _normalize_target_words(data.get("target_words"))
        if not target_words:
            return jsonify({"error": "target_words must be a non-empty array"}), 400

        allow_word_forms = bool(data.get("allow_word_forms", False))
        words_per_term = data.get("words_per_term", DEFAULT_WORDS_PER_TERM)
        if not isinstance(words_per_term, int) or words_per_term <= 0:
            words_per_term = DEFAULT_WORDS_PER_TERM

        prompt = READING_PROMPT_TEMPLATE.format(
            target_words=", ".join(target_words),
            allow_word_forms=str(allow_word_forms).lower(),
            words_per_term=words_per_term,
        )

        try:
            llm_response = _call_llm(prompt)
            text = str(llm_response.get("text") or "").strip()
            if not text:
                raise ReadingLLMError("LLM returned empty text")
        except ReadingLLMError as exc:
            print(f"[Reading] /generate fallback due to LLM error: {exc}", flush=True)
            text = _fallback_text(target_words, words_per_term)

        return jsonify(
            {
                "text": text,
                "target_words": target_words,
                "allow_word_forms": allow_word_forms,
                "words_per_term": words_per_term,
            }
        )
