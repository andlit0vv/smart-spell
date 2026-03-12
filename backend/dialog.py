import json
import os
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib import error, request

from flask import jsonify, request as flask_request


OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4.1-mini"

GENERATE_PROMPT = """You are an English learning exercise generator.

Your task is to create a short practice scenario for an English learner.

INPUT VARIABLES
USER_DESCRIPTION: {user_description}
TARGET_WORDS: {target_words}
FOCUS_WORD: {focus_word}
LEVEL: {english_level}
PREVIOUS_SITUATIONS: {previous_situations}

TASK
Generate:
1) A realistic situation related to the user's professional or personal context.
2) A question based on that situation.

The learner must answer the question using TARGET_WORDS.

INSTRUCTIONS

1. Carefully analyze USER_DESCRIPTION to understand the user's profession, interests, and typical environment.
2. Generate a realistic situation connected to that context (work meeting, interview, presentation, discussion, negotiation, technical problem, etc.).
3. The situation must logically create opportunities to use as many TARGET_WORDS as possible in one answer.
4. Prioritize broad, flexible contexts where multiple words from TARGET_WORDS can fit naturally together.
5. FOCUS_WORD must definitely be usable in the answer.
6. The situation must be specific and concrete.
7. Do NOT explain target words.
8. Do NOT include target words inside the question.
9. The question must logically follow the situation.
10. The question must encourage explanation, description, or justification.
11. Language must match LEVEL.
12. The situation should be 1–2 sentences.
13. The question should be 1 sentence.
14. If the situation does not naturally allow multiple TARGET_WORDS (or at least FOCUS_WORD) to be used in the answer, regenerate the situation.
15. The new situation must be meaningfully different from PREVIOUS_SITUATIONS (different context, goal, and challenge).
16. Avoid overused themes unless explicitly requested by USER_DESCRIPTION (for example: time zones, scheduling meetings).
17. If USER_DESCRIPTION is vague, diversify by choosing varied domains (daily life, travel, study, health, shopping, social plans, technology, customer service, hobbies, etc.).
18. Prefer situations where very different words (abstract + concrete, technical + everyday) can still be used naturally in one response.

OUTPUT FORMAT (JSON)

{{
  "situation": "...",
  "question": "..."
}}"""

QUESTION_PROMPT = """You are an English learning exercise generator.

INPUT VARIABLES
SITUATION: {situation}
TARGET_WORDS: {target_words}
LEVEL: {english_level}
PREVIOUS_QUESTION: {previous_question}

TASK
Generate one question (1 sentence) that logically follows the situation and encourages explanation.
The learner should be able to naturally use one or more target words in the answer.
Do not include any target word directly inside the question.
Use language suitable for LEVEL.
If PREVIOUS_QUESTION is provided, create a new question with a different angle and wording while staying in the same situation.

OUTPUT FORMAT (JSON)
{{
  "question": "..."
}}"""

CHECK_PROMPT = """You are an English language tutor reviewing a learner's sentence.

Your task is to evaluate whether the learner used English correctly and whether the TARGET_WORD is used properly.

INPUT VARIABLES

TARGET_WORD: {target_word}
USER_ANSWER: {user_answer}
LEVEL: {english_level}

TASK

Analyze the learner’s sentence and check:

1. Grammar correctness
2. Correct and natural use of TARGET_WORD
3. Correct word form and sentence structure
4. Optional style improvements (clarity, precision, natural alternatives)

INSTRUCTIONS

- If the sentence is correct and natural, do NOT provide corrections.
- Simply confirm that everything is correct.
- If there are mistakes, briefly explain what is wrong.
- Always provide the corrected sentence if an error exists.
- Feedback must be short, clear, and supportive.
- Do NOT explain grammar rules in detail.
- Do NOT mark an answer as incorrect only because it is short.
- Short answers are acceptable when they are grammatically correct and use TARGET_WORD naturally.
- The learner level is LEVEL, but still detect genuine errors normally.
- The TARGET_WORD should be represented in the answer in a correct and natural way.
- Different grammatical/derivational forms of TARGET_WORD are acceptable (e.g., containerization/containerize), if the same lexical root is used appropriately.
- IMPORTANT: Do NOT mark as incorrect for register/style reasons alone (for example: "too informal", "awkward but understandable", "unclear but acceptable", "could be more specific").
- These style points must be returned as optional tips, not as errors.
- Mark as "incorrect" only for genuine language errors: broken grammar, wrong word form, clearly unnatural/incorrect TARGET_WORD usage, or meaning-breaking structure.
- If grammar and TARGET_WORD usage are acceptable, return status "correct" and optionally include a short tip.
- Tip format should be concise and recommendation-only.

OUTPUT FORMAT

Return JSON only.

If the sentence is correct:

{{
  "status": "correct",
  "message": "Great!",
  "tip": "Optional recommendation, or empty string"
}}

If the sentence contains errors:

{{
  "status": "incorrect",
  "message": "Short explanation of the mistake.",
  "correction": "Corrected version of the sentence."
}}"""


class DialogLLMError(Exception):
    pass


@dataclass
class DialogState:
    target_words: list[str]
    word_status: dict[str, str]
    situation_history: list[str] = field(default_factory=list)

    @property
    def correct_count(self) -> int:
        return sum(1 for status in self.word_status.values() if status == "correct")

    @property
    def total_words(self) -> int:
        return len(self.target_words)

    def to_dict(self) -> dict[str, Any]:
        return {
            "target_words": self.target_words,
            "word_status": self.word_status,
            "correct_count": self.correct_count,
            "total_words": self.total_words,
        }


DIALOG_STATES: dict[str, DialogState] = {}


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


def _call_llm(prompt: str, *, temperature: float = 0.2) -> dict[str, Any]:
    _load_local_env()
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise DialogLLMError("OPENAI_API_KEY is not set")

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
                "temperature": temperature,
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
        raise DialogLLMError(f"OpenAI HTTP error {exc.code}: {details}") from exc
    except error.URLError as exc:
        raise DialogLLMError(f"OpenAI connection error: {exc.reason}") from exc
    except TimeoutError as exc:
        raise DialogLLMError("OpenAI request timed out") from exc

    choices = payload.get("choices") or []
    if not choices:
        raise DialogLLMError("OpenAI response has no choices")

    message = choices[0].get("message") or {}
    content = message.get("content")
    if not content:
        raise DialogLLMError("OpenAI response has empty content")

    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise DialogLLMError("LLM did not return valid JSON") from exc


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


def _get_or_create_state(practice_id: str | None, target_words: list[str]) -> tuple[str, DialogState]:
    if practice_id and practice_id in DIALOG_STATES:
        state = DIALOG_STATES[practice_id]
        if [w.lower() for w in state.target_words] == [w.lower() for w in target_words]:
            return practice_id, state

    new_id = str(uuid.uuid4())
    state = DialogState(
        target_words=target_words,
        word_status={word: "unused" for word in target_words},
    )
    DIALOG_STATES[new_id] = state
    return new_id, state


def _remaining_words(state: DialogState) -> list[str]:
    return [
        word
        for word in state.target_words
        if state.word_status.get(word) in {"unused", "incorrect"}
    ]


def _word_present(answer: str, word: str) -> bool:
    normalized_answer = answer.lower()
    normalized_word = word.lower().strip()

    if " " in normalized_word:
        pattern = r"\b" + re.escape(normalized_word).replace(r"\ ", r"\s+") + r"\b"
    else:
        pattern = r"\b" + re.escape(normalized_word) + r"\b"

    if re.search(pattern, normalized_answer, flags=re.IGNORECASE):
        return True

    if " " in normalized_word:
        return False

    answer_tokens = re.findall(r"[a-zA-Z]+", normalized_answer)
    target_stem = _normalize_word_stem(normalized_word)
    if len(target_stem) < 5:
        return False

    return any(_normalize_word_stem(token) == target_stem for token in answer_tokens)


def _normalize_word_stem(word: str) -> str:
    """Return a lightweight stem to match close lexical forms (e.g. containerization/containerize)."""
    stem = word.lower().strip()
    suffixes = (
        "ization",
        "isation",
        "ational",
        "ation",
        "ition",
        "ment",
        "ness",
        "ingly",
        "edly",
        "izing",
        "ising",
        "ized",
        "ised",
        "ing",
        "ed",
        "ize",
        "ise",
        "izer",
        "iser",
        "ly",
        "ity",
        "ty",
        "al",
        "ic",
        "er",
        "or",
        "s",
    )

    changed = True
    while changed:
        changed = False
        for suffix in suffixes:
            if len(stem) - len(suffix) < 4:
                continue
            if stem.endswith(suffix):
                stem = stem[: -len(suffix)]
                changed = True
                break

    return stem


def _fallback_generate_response(target_word: str, english_level: str) -> dict[str, str]:
    level_label = english_level or "B1"
    return {
        "situation": (
            f"You are preparing for an important conversation at {level_label} level and need to explain your idea clearly."
        ),
        "question": f"How would you use the word '{target_word}' naturally in your response?",
    }


def _fallback_question_response(situation: str) -> dict[str, str]:
    trimmed = situation.strip()
    return {
        "question": f"Given this situation, what would you say and why?" if trimmed else "What would you say in this case?"
    }

def register_dialog_endpoints(app):
    @app.post("/api/dialog/generate")
    def dialog_generate():
        data = flask_request.get_json(silent=True) or {}
        target_words = _normalize_target_words(data.get("target_words"))
        if not target_words:
            return jsonify({"error": "target_words must be a non-empty array"}), 400

        practice_id, state = _get_or_create_state(data.get("practice_id"), target_words)
        remaining = _remaining_words(state)
        focus_word = remaining[0] if remaining else target_words[0]

        english_level = (data.get("level") or "B1").strip()
        try:
            llm_response = _call_llm(
                GENERATE_PROMPT.format(
                    user_description=(data.get("user_description") or "").strip() or "English learner",
                    target_words=", ".join(target_words),
                    focus_word=focus_word,
                    english_level=english_level,
                    previous_situations=" | ".join(state.situation_history[-5:]) or "none",
                )
                ,
                temperature=0.9,
            )
        except DialogLLMError as exc:
            print(f"[Dialog] /generate fallback due to LLM error: {exc}", flush=True)
            llm_response = _fallback_generate_response(focus_word, english_level)

        situation = str(llm_response.get("situation") or "").strip()
        question = str(llm_response.get("question") or "").strip()
        if situation:
            state.situation_history.append(situation)

        return jsonify(
            {
                "practice_id": practice_id,
                "situation": situation,
                "question": question,
                "practice_state": state.to_dict(),
            }
        )

    @app.post("/api/dialog/question")
    def dialog_question():
        data = flask_request.get_json(silent=True) or {}
        situation = (data.get("situation") or "").strip()
        target_words = _normalize_target_words(data.get("target_words"))
        if not situation:
            return jsonify({"error": "situation is required"}), 400
        if not target_words:
            return jsonify({"error": "target_words must be a non-empty array"}), 400

        english_level = (data.get("level") or "B1").strip()
        previous_question = (data.get("previous_question") or "").strip()
        try:
            llm_response = _call_llm(
                QUESTION_PROMPT.format(
                    situation=situation,
                    target_words=", ".join(target_words),
                    english_level=english_level,
                    previous_question=previous_question or "none",
                )
                ,
                temperature=0.6,
            )
        except DialogLLMError as exc:
            print(f"[Dialog] /question fallback due to LLM error: {exc}", flush=True)
            llm_response = _fallback_question_response(situation)

        return jsonify({"question": str(llm_response.get("question") or "").strip()})

    @app.post("/api/dialog/check")
    def dialog_check():
        data = flask_request.get_json(silent=True) or {}
        answer = (data.get("answer") or "").strip()
        target_words = _normalize_target_words(data.get("target_words"))
        if not answer:
            return jsonify({"error": "answer is required"}), 400
        if not target_words:
            return jsonify({"error": "target_words must be a non-empty array"}), 400

        practice_id, state = _get_or_create_state(data.get("practice_id"), target_words)

        used_words = [word for word in state.target_words if _word_present(answer, word)]
        missing_words = [word for word in state.target_words if word not in used_words]

        correct_words: list[str] = []
        incorrect_words: list[str] = []
        messages: list[str] = []
        corrections: list[str] = []
        tips: list[str] = []

        words_to_check = used_words if used_words else [state.target_words[0]]

        for word in words_to_check:
            try:
                llm_response = _call_llm(
                    CHECK_PROMPT.format(
                        target_word=word,
                        user_answer=answer,
                        english_level=(data.get("level") or "B1").strip(),
                    )
                )
            except DialogLLMError as exc:
                return jsonify({"error": str(exc)}), 502

            status = str(llm_response.get("status") or "").strip().lower()
            tip = str(llm_response.get("tip") or "").strip()
            if status == "correct" and word in used_words:
                correct_words.append(word)
                state.word_status[word] = "correct"
                if tip:
                    tips.append(f"{word}: Tip: {tip}")
            else:
                if word in used_words:
                    incorrect_words.append(word)
                    state.word_status[word] = "incorrect"
                message = str(llm_response.get("message") or "").strip()
                correction = str(llm_response.get("correction") or "").strip()
                if message:
                    messages.append(f"{word}: {message}")
                if correction:
                    corrections.append(f"{word}: {correction}")
                if tip:
                    tips.append(f"{word}: Tip: {tip}")

        if not used_words:
            missing_list = ", ".join(missing_words)
            messages.insert(0, f"Please include at least one target word in your answer: {missing_list}.")

        for word in missing_words:
            if state.word_status.get(word) != "correct":
                state.word_status[word] = "unused"

        is_complete = state.correct_count == state.total_words
        feedback_lines = messages + tips

        return jsonify(
            {
                "practice_id": practice_id,
                "correct_words": correct_words,
                "incorrect_words": incorrect_words,
                "missing_words": missing_words,
                "message": "\n".join(feedback_lines) if feedback_lines else "Great! The words you used are correct.",
                "correction": "\n".join(corrections),
                "practice_state": state.to_dict(),
                "is_complete": is_complete,
            }
        )
