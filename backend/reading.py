import json
import os
import re
from pathlib import Path
from typing import Any
from urllib import error, request

from flask import jsonify, request as flask_request


OPENAI_API_URL = "https://api.openai.com/v1/responses"
DEFAULT_MODEL = "gpt-5-mini"

MIN_TOTAL_WORDS = 100
MAX_TOTAL_WORDS = 120
TARGET_TOTAL_WORDS = 110
MAX_GENERATION_ATTEMPTS = 3


SYSTEM_PROMPT = """
You generate short contextual English reading texts for vocabulary learning.

The story must be based on the user's bio.

The bio may contain:
- profession
- field of work
- personal interests
- project name
- company name

Your task is to interpret the bio and determine the most likely real-world context.

Strict rule:
The story MUST stay inside that context.

Examples of interpretation:

doctor → hospital, clinic, patients, medical work  
data analyst → analytics, reports, dashboards, data pipelines  
student → university, studying, lectures  
startup name → building a product or working on a startup

Never switch to an unrelated domain.

Example:
If the bio indicates a doctor, do NOT write about software development,
websites, programming, or debugging.

Story rules:

1. Length: 100–120 words.
2. Every target word must appear exactly once.
3. Natural English.
4. Two or more paragraphs.
5. Words must appear naturally inside the story.
6. Context must clearly match the user's bio.
7. Do NOT list the words.
8. Avoid artificial sentences like vocabulary drills.

Return JSON only:

{
"text": "<generated text>"
}
"""


EXAMPLE_BLOCK = """
Example style.

Example 1

User bio: doctor

Target words:
diagnosis, symptom, treatment

Example text:

The patient arrived early in the morning complaining about a strange
symptom that had started during the night.

After examining several test results I began to form a possible
diagnosis. Fortunately the condition was not serious, and we were able
to start a simple treatment plan that should help him recover within
a few days.



Example 2

User bio: university student

Target words:
lecture, assignment, deadline

Example text:

The lecture this morning was much more difficult than I expected.

Our professor explained the new assignment and reminded us that the
deadline was approaching quickly. I realized I would need to spend the
entire weekend studying if I wanted to finish everything on time.
"""


class ReadingLLMError(Exception):
    pass


def _count_words(text: str) -> int:
    return len(re.findall(r"\b[\w']+\b", text))


def _contains_target_word(text: str, target_word: str) -> bool:
    pattern = re.compile(rf"\b{re.escape(target_word.lower())}\b")
    return bool(pattern.search(text.lower()))


def _validate_generated_text(text: str, target_words: list[str], allow_word_forms: bool):
    wc = _count_words(text)

    if wc < MIN_TOTAL_WORDS or wc > MAX_TOTAL_WORDS:
        raise ReadingLLMError(
            f"Generated text has {wc} words, expected {MIN_TOTAL_WORDS}-{MAX_TOTAL_WORDS}"
        )

    if not allow_word_forms:
        missing = [w for w in target_words if not _contains_target_word(text, w)]
        if missing:
            raise ReadingLLMError(f"Missing target words: {missing}")


def _load_local_env():
    backend_dir = Path(__file__).resolve().parent

    for candidate in (backend_dir / ".env", backend_dir.parent / ".env"):
        if not candidate.exists():
            continue

        for line in candidate.read_text(encoding="utf-8").splitlines():

            stripped = line.strip()

            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue

            key, value = stripped.split("=", 1)

            os.environ.setdefault(
                key.strip(),
                value.strip().strip('"').strip("'")
            )


_load_local_env()


def _extract_content(response_data):

    if "output_text" in response_data:

        text = response_data["output_text"]

        if isinstance(text, list):
            return "".join(text)

        if isinstance(text, str):
            return text

    for item in response_data.get("output", []):

        if item.get("type") == "message":

            for part in item.get("content", []):

                if "text" in part:
                    return part["text"]

    raise ReadingLLMError(f"Invalid OpenAI response format: {response_data}")


def _call_llm(prompt: str):

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise ReadingLLMError("OPENAI_API_KEY not set")

    payload = {

        "model": 'gpt-5-mini',

        "input": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": prompt
            }
        ],

        "max_output_tokens": 1000,

        "reasoning": {
            "effort": "low"
        },

        "prompt_cache_key": "reading-text-v2",

        "text": {
            "format": {"type": "json_object"}
        }
    }

    req = request.Request(
        OPENAI_API_URL,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        data=json.dumps(payload).encode("utf-8"),
    )

    try:

        with request.urlopen(req, timeout=40) as response:

            response_data = json.loads(response.read().decode("utf-8"))

    except error.HTTPError as exc:

        details = exc.read().decode("utf-8", errors="ignore")

        raise ReadingLLMError(f"OpenAI HTTP error {exc.code}: {details}")

    except error.URLError as exc:

        raise ReadingLLMError(f"OpenAI connection error: {exc.reason}")

    except TimeoutError:

        raise ReadingLLMError("OpenAI timeout")

    content = _extract_content(response_data)

    if not content:
        raise ReadingLLMError("LLM returned empty text")

    try:
        return json.loads(content)

    except json.JSONDecodeError:
        raise ReadingLLMError("LLM returned invalid JSON")


def register_reading_endpoints(app):

    @app.post("/api/reading/generate")

    def reading_generate():

        data = flask_request.get_json(silent=True) or {}

        target_words = data.get("target_words") or []
        allow_word_forms = bool(data.get("allow_word_forms", False))

        user_bio = str(data.get("user_bio") or "").strip()
        level = str(data.get("level") or "B1").strip()

        story_prompt = str(data.get("story_prompt") or "").strip()

        if not target_words:
            return jsonify({"error": "target_words required"}), 400

        prompt = f"""

        User bio:
        {user_bio if user_bio else "unknown"}

        English level:
        {level}

        Target words:
        {", ".join(target_words)}

        Situation hint:
        {story_prompt if story_prompt else "create a realistic short situation"}

        Important:
        The story MUST happen in the real-world context implied by the user's bio.

        {EXAMPLE_BLOCK}

        Write the story.
        """

        text = ""

        last_error = None

        for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):

            try:

                response = _call_llm(prompt)

                text = str(response.get("text") or "").strip()

                if not text:
                    raise ReadingLLMError("Empty text")

                _validate_generated_text(text, target_words, allow_word_forms)

                last_error = None
                break

            except ReadingLLMError as exc:

                last_error = exc

                print(
                    f"[Reading] generation attempt {attempt}/{MAX_GENERATION_ATTEMPTS} failed: {exc}",
                    flush=True,
                )

        if last_error:

            print(f"[Reading] fallback due to: {last_error}")

            text = " ".join(target_words)

        return jsonify(
            {
                "text": text,
                "target_words": target_words,
                "allow_word_forms": allow_word_forms,
                "level": level,
                "user_bio": user_bio
            }
        )