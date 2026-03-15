
import json
import os
import re
from pathlib import Path
from typing import Any
from urllib import error, request

from flask import jsonify, request as flask_request

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-5-mini"
MIN_TOTAL_WORDS = 100
MAX_TOTAL_WORDS = 120
TARGET_TOTAL_WORDS = 110
MAX_GENERATION_ATTEMPTS = 3

SYSTEM_PROMPT = """
You are an assistant that generates short learning texts for English learners.

Rules:

1. The total length must be 100–120 words.
2. Every target word form must appear exactly once.
3. Text must sound natural and coherent.
4. Match the learner level.
5. If allow_word_forms=false use exact form.
6. If allow_word_forms=true grammatical forms allowed.
7. Do not list words separately.
8. Return JSON only.

Output format:
{
  "text": "<generated text>"
}
"""


class ReadingLLMError(Exception):
    pass


def _count_words(text: str) -> int:
    return len(re.findall(r"\b[\w']+\b", text))


def _contains_target_word(text: str, target_word: str) -> bool:
    pattern = re.compile(rf"\b{re.escape(target_word.lower())}\b")
    return bool(pattern.search(text.lower()))


def _validate_generated_text(
    text: str,
    target_words: list[str],
    allow_word_forms: bool,
) -> None:
    actual_word_count = _count_words(text)
    if actual_word_count < MIN_TOTAL_WORDS or actual_word_count > MAX_TOTAL_WORDS:
        raise ReadingLLMError(
            f"Generated text has {actual_word_count} words, expected {MIN_TOTAL_WORDS}-{MAX_TOTAL_WORDS}"
        )

    if not allow_word_forms:
        missing = [word for word in target_words if not _contains_target_word(text, word)]
        if missing:
            raise ReadingLLMError(f"Generated text is missing target words: {', '.join(missing)}")


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


def _call_llm(system_prompt: str, user_prompt: str) -> dict[str, Any]:
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
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
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


def _fallback_text(target_words: list[str]) -> str:
    target_count = max(TARGET_TOTAL_WORDS, len(target_words))
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
        story_prompt = str(data.get("story_prompt") or "").strip()
        english_level = str(data.get("level") or "B1").strip() or "B1"

        user_prompt = f"""
    Input:

    target_words: {", ".join(target_words)}
    allow_word_forms: {str(allow_word_forms).lower()}
    story_prompt: {story_prompt if story_prompt else "not provided"}
    level: {english_level}

    Generate a natural English learning text.
    """

        text = ""
        generation_error: ReadingLLMError | None = None

        for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):
            try:
                llm_response = _call_llm(SYSTEM_PROMPT, user_prompt)

                text = str(llm_response.get("text") or "").strip()

                if not text:
                    raise ReadingLLMError("LLM returned empty text")

                _validate_generated_text(text, target_words, allow_word_forms)

                generation_error = None
                break

            except ReadingLLMError as exc:
                generation_error = exc
                print(
                    f"[Reading] Invalid generation attempt {attempt}/{MAX_GENERATION_ATTEMPTS}: {exc}",
                    flush=True,
                )

        if generation_error:
            print(f"[Reading] /generate fallback due to LLM error: {generation_error}", flush=True)
            text = _fallback_text(target_words)

        return jsonify(
            {
                "text": text,
                "target_words": target_words,
                "allow_word_forms": allow_word_forms,
                "min_words": MIN_TOTAL_WORDS,
                "max_words": MAX_TOTAL_WORDS,
                "story_prompt": story_prompt,
                "level": english_level,
            }
        )