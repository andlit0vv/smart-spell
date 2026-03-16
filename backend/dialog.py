import json
import os
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib import error, request

from flask import jsonify, request as flask_request


OPENAI_API_URL = "https://api.openai.com/v1/responses"
DEFAULT_MODEL = "gpt-4.1-mini"


MAX_QUESTION_LENGTH = 100
MAX_SITUATION_LENGTH = 120


def _limit_question_length(question: str) -> str:
    q = question.strip()
    return q[:MAX_QUESTION_LENGTH]

def _limit_situation_length(situation: str) -> str:
    s = situation.strip()
    return s[:MAX_SITUATION_LENGTH]

DIALOG_RULES_V1 = '''
You generate English speaking practice exercises.

The learner receives:
1) a short situation
2) a question

The learner answers using TARGET_WORDS.

Rules:

Situation
• 1 sentence
• ≤120 characters
• realistic scenario
• should allow natural use of TARGET_WORDS
• must allow use of FOCUS_WORD

Question
• 1 sentence
• ≤100 characters
• must logically follow the situation
• must NOT contain TARGET_WORDS
• should encourage explanation or reasoning

General

• adapt to learner LEVEL
• prefer contexts related to USER_BIO
• avoid repeating PREVIOUS_SITUATIONS
• natural everyday language

Return JSON only.

For pair generation:


 "situation": "...",
 "question": "..."


For question generation:


 "question": "..."


No explanations.
Return JSON immediately.
'''


DIALOG_EXAMPLES_V1 = '''
Example 1

Input:
bio: software developer
level: B1
focus_word: debug
target_words: debug, optimize, workflow

Output:

 "situation": "Your web app crashes when users upload large files.",
 "question": "How would you investigate and solve the problem?"


---

Example 2

Input:
bio: marketing manager
level: B1-B2
focus_word: campaign
target_words: campaign, audience, metrics

Output:

 "situation": "Your online campaign brings visitors but few purchases.",
 "question": "What changes would you try to improve results?"


---

Example 3

Input:
bio: university student
level: A2-B1
focus_word: budget
target_words: budget, travel, flexible

Output:

 "situation": "You want to travel abroad but your money is limited.",
 "question": "How would you plan the trip?"


---

Example 4

Input:
bio: data analyst
level: B1-B2
focus_word: dataset
target_words: dataset, pipeline, dashboard

Output:

 "situation": "Your team receives messy data before an important report.",
 "question": "How would you prepare the data for analysis?"

'''

DIALOG_TASK_GENERATE_PAIR = '''
TASK: generate_pair

INPUT

bio: {user_bio}
level: {level}
focus_word: {focus_word}
target_words: {target_words}
previous_situations: {previous_situations}

Generate a NEW situation and a question.
Avoid repeating previous situations.
'''

DIALOG_TASK_REGENERATE_QUESTION = '''
TASK: regenerate_question

INPUT

situation: {situation}
level: {level}
target_words: {target_words}
previous_question: {previous_question}

Generate a DIFFERENT question for this situation.

The question must:
• logically follow the situation
• not contain target words
• have a different angle than previous_question
'''

DIALOG_TASK_QUESTION_FROM_SITUATION = '''
TASK: question_from_situation

INPUT

situation: {situation}
level: {level}
target_words: {target_words}

Generate a question that fits the situation.
The learner should be able to naturally use target words in the answer.
Do not include target words in the question.
'''


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
- Do NOT require exact token matching for TARGET_WORD: inflected and derivationally related forms are valid when they fit the sentence meaning and grammar.
- Different grammatical/derivational forms of TARGET_WORD are acceptable (e.g., implement/implemented/implementation, containerization/containerize), if the same lexical root is used appropriately.
- If TARGET_WORD (or its valid form) is used correctly, never mark the answer as incorrect just because another wording could sound more natural.
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

_load_local_env()


def _build_generate_prompt(user_bio, level, focus_word, target_words, previous_situations):
    return f"""
{DIALOG_RULES_V1}

{DIALOG_EXAMPLES_V1}

{DIALOG_TASK_GENERATE_PAIR.format(
    user_bio=user_bio,
    level=level,
    focus_word=focus_word,
    target_words=", ".join(target_words),
    previous_situations=previous_situations
)}
"""


def _build_regenerate_question_prompt(situation, level, target_words, previous_question):
    return f"""
{DIALOG_RULES_V1}

{DIALOG_EXAMPLES_V1}

{DIALOG_TASK_REGENERATE_QUESTION.format(
    situation=situation,
    level=level,
    target_words=", ".join(target_words),
    previous_question=previous_question
)}
"""

def _build_question_from_situation_prompt(situation, level, target_words):
    return f"""
{DIALOG_RULES_V1}

{DIALOG_EXAMPLES_V1}

{DIALOG_TASK_QUESTION_FROM_SITUATION.format(
    situation=situation,
    level=level,
    target_words=", ".join(target_words)
)}
"""


def _extract_content(response_data: dict) -> str:
    try:
        # Fast path (Responses API)
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

        raise DialogLLMError("No text content in OpenAI response")

    except Exception:
        raise DialogLLMError(f"Invalid OpenAI response format: {response_data}")

def _call_llm(prompt: str, cache_key: str = "dialog-v1") -> dict[str, Any]:

    _load_local_env()

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise DialogLLMError("OPENAI_API_KEY is not set")

    payload = {
        "model": 'gpt-5-nano',
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt}
                ]
            }
        ],
        "max_output_tokens": 1000,
        "reasoning": {
            "effort": "minimal"
        },
        "prompt_cache_key": cache_key,
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
        with request.urlopen(req, timeout=60) as response:
            response_data = json.loads(response.read().decode("utf-8"))

    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise DialogLLMError(f"OpenAI HTTP error {exc.code}: {details}") from exc

    except error.URLError as exc:
        raise DialogLLMError(f"OpenAI connection error: {exc.reason}") from exc

    except TimeoutError as exc:
        raise DialogLLMError("OpenAI request timed out") from exc

    content = _extract_content(response_data)

    if not content:
        raise DialogLLMError(f"LLM returned empty response: {response_data}")

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
        "situation": _limit_situation_length(
            f"You are preparing for an important conversation at {level_label} level and need to explain your idea clearly."
        ),
        "question": _limit_question_length(f"How would you use the word '{target_word}' naturally in your response?"),
    }


def _fallback_question_response(situation: str) -> dict[str, str]:
    trimmed = situation.strip()
    return {
        "question": _limit_question_length(f"Given this situation, what would you say and why?" if trimmed else "What would you say in this case?")
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
            prompt = _build_generate_prompt(
                user_bio=(data.get("user_description") or "").strip() or "English learner",
                level=english_level,
                focus_word=focus_word,
                target_words=target_words,
                previous_situations=" | ".join(state.situation_history[-5:]) or "none"
            )

            llm_response = _call_llm(prompt, cache_key="dialog-generate-v1")


        except DialogLLMError as exc:
            print(f"[Dialog] /generate fallback due to LLM error: {exc}", flush=True)
            llm_response = _fallback_generate_response(focus_word, english_level)

        situation = _limit_situation_length(str(llm_response.get("situation") or ""))
        question = _limit_question_length(str(llm_response.get("question") or ""))
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
        situation = _limit_situation_length(str(data.get("situation") or ""))
        target_words = _normalize_target_words(data.get("target_words"))
        if not situation:
            return jsonify({"error": "situation is required"}), 400
        if not target_words:
            return jsonify({"error": "target_words must be a non-empty array"}), 400

        english_level = (data.get("level") or "B1").strip()
        previous_question = (data.get("previous_question") or "").strip()
        try:
            prompt = _build_regenerate_question_prompt(
                situation=situation,
                level=english_level,
                target_words=target_words,
                previous_question=previous_question or "none"
            )

            llm_response = _call_llm(prompt, cache_key="dialog-question-v1")


        except DialogLLMError as exc:
            print(f"[Dialog] /question fallback due to LLM error: {exc}", flush=True)
            llm_response = _fallback_question_response(situation)

        return jsonify({"question": _limit_question_length(str(llm_response.get("question") or ""))})

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