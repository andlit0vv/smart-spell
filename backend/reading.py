
import json
import os
import re
from pathlib import Path
from typing import Any
from urllib import error, request

from flask import jsonify, request as flask_request

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-5.2"
DEFAULT_WORDS_PER_TERM = 30
MAX_GENERATION_ATTEMPTS = 3

READING_PROMPT_TEMPLATE = """You are an assistant that generates short learning texts for English learners.

Input:
- target_words: {target_words}
- allow_word_forms: {allow_word_forms}
- words_per_term: {words_per_term}
- story_prompt: {story_prompt}

Task:
Generate a natural English text that includes ALL target words.

Instructions:
Step 1. Compute the required number of words:
required_words = len(target_words) × words_per_term

Step 2. Plan a short text that will contain exactly required_words words.

Step 3. Write the text.

Step 4. Count the words in the generated text and ensure the count equals required_words.
If it does not match, regenerate the text

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

7. The text MUST contain exactly required_words words.
Not more. Not less.

8. If story_prompt is provided (non-empty), use it as the topic or setting for the text.

Example 1:

Input:
target_words: deployment, correspond, satisfy, retrieve
allow_word_forms: false

Output:
{{
  "text": "The engineering team prepared a careful deployment late on Friday evening. Every step had to correspond exactly to the checklist created earlier in the week. Their goal was simple: satisfy the client and avoid unexpected problems.

Before starting, one developer needed to retrieve several configuration files from the internal server. These files helped the system correspond correctly with external services after the deployment. Once everything was ready, the team ran the final commands and watched the update complete successfully.

The result was stable and efficient. The logs helped retrieve useful performance data, and the solution continued to satisfy the needs of the users."
}}


Example 2:

Input:
target_words: deploy, correspond, satisfy, retrieve
allow_word_forms: true

Output:
{{
  "text": "A small software team planned to deploy a new feature for their analytics platform. The engineers checked that the system configuration corresponded with the documentation before starting the update. Their main goal was to satisfy the company’s growing number of users.

During the process, the monitoring service retrieved several error reports from the server. One developer carefully reviewed the data and noticed that a few values did not correspond to the expected results. After fixing the issue, the team deployed the update successfully.

The new version worked smoothly. The system could now retrieve information faster, and the improved performance helped satisfy the expectations of the product team."
}}

Output format:
Return JSON only:
{{
  "text": "<generated text>"
}}
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
    words_per_term: int,
    allow_word_forms: bool,
) -> None:
    required_word_count = len(target_words) * words_per_term
    actual_word_count = _count_words(text)
    if actual_word_count != required_word_count:
        raise ReadingLLMError(
            f"Generated text has {actual_word_count} words, expected {required_word_count}"
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
        story_prompt = str(data.get("story_prompt") or "").strip()

        words_per_term = data.get("words_per_term", DEFAULT_WORDS_PER_TERM)
        if not isinstance(words_per_term, int) or words_per_term <= 0:
            words_per_term = DEFAULT_WORDS_PER_TERM

        prompt = READING_PROMPT_TEMPLATE.format(
            target_words=", ".join(target_words),
            allow_word_forms=str(allow_word_forms).lower(),
            words_per_term=words_per_term,
            story_prompt=story_prompt if story_prompt else "not provided",
        )

        text = ""
        generation_error: ReadingLLMError | None = None
        for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):
            try:
                llm_response = _call_llm(prompt)
                text = str(llm_response.get("text") or "").strip()
                if not text:
                    raise ReadingLLMError("LLM returned empty text")
                _validate_generated_text(text, target_words, words_per_term, allow_word_forms)
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
            text = _fallback_text(target_words, words_per_term)

        return jsonify(
            {
                "text": text,
                "target_words": target_words,
                "allow_word_forms": allow_word_forms,
                "words_per_term": words_per_term,
                "story_prompt": story_prompt,
            }
        )
