import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal
from urllib import error, request

from llm import DEFAULT_MODEL, LLMError, OPENAI_API_URL

WordStatus = Literal["unused", "correct", "incorrect"]

SCENARIO_PROMPT_TEMPLATE = """You are an English learning exercise generator.

Your task is to create a short practice scenario for an English learner.

INPUT VARIABLES
USER_DESCRIPTION: {user_description}
TARGET_WORDS: {target_words}
LEVEL: {english_level}

TASK
Generate:
1) A realistic situation related to the user's professional or personal context.
2) A question based on that situation.

The learner must answer the question using one or more TARGET_WORDS.

INSTRUCTIONS

1. Carefully analyze USER_DESCRIPTION to understand the user's profession, interests, and typical environment.
2. Generate a realistic situation connected to that context (work meeting, interview, presentation, discussion, negotiation, technical problem, etc.).
3. The situation must logically create an opportunity to use TARGET_WORDS in the answer.
4. The situation must be specific and concrete.
5. Do NOT explain the TARGET_WORDS.
6. Do NOT include the TARGET_WORDS inside the question.
7. The question must logically follow the situation.
8. The question must encourage explanation, description, or justification.
9. Language must match LEVEL.
10. The situation should be 1–2 sentences.
11. The question should be 1 sentence.
12. If the situation does not naturally allow TARGET_WORDS to be used in the answer, regenerate the situation.

OUTPUT FORMAT (JSON)

{{
  "situation": "...",
  "question": "..."
}}
"""

QUESTION_FROM_SITUATION_PROMPT_TEMPLATE = """You are an English learning exercise generator.

INPUT:
SITUATION: {situation}
TARGET_WORDS: {target_words}
LEVEL: {english_level}

TASK:
Generate a question that logically follows the situation.

The learner should be able to use one or more TARGET_WORDS in the answer.

Do not include TARGET_WORDS directly in the question.

Return JSON:

{{
  "question": "..."
}}
"""

EVALUATION_PROMPT_TEMPLATE = """You are an English language tutor reviewing a learner's sentence.

INPUT VARIABLES
TARGET_WORDS: {target_words}
USER_ANSWER: {user_answer}
LEVEL: {english_level}

TASK
Analyze the learner's sentence and return JSON with:
1) Grammar correctness
2) Correct and natural use of each target word
3) Naturalness of phrasing in modern English
4) Correct word form and sentence structure

IMPORTANT
- Be strict about whether each target word was used correctly in context.
- A word counts as incorrect if form or usage is wrong.
- A word counts as missing if it does not appear in any acceptable form.
- If sentence is fully correct for used words, keep message short.
- If there are mistakes, include a short explanation and corrected sentence.

Return JSON only:
{{
  "status": "correct" | "incorrect",
  "message": "Short feedback",
  "correction": "Corrected sentence when needed, else empty string",
  "correct_words": ["..."],
  "incorrect_words": ["..."],
  "missing_words": ["..."],
  "grammar_ok": true | false
}}
"""


@dataclass
class DialogueRound:
    situation: str
    question: str
    target_words: list[str]


@dataclass
class DialogueFeedback:
    status: Literal["correct", "incorrect"]
    message: str
    correction: str
    grammar_ok: bool
    correct_words: list[str]
    incorrect_words: list[str]
    missing_words: list[str]
    word_statuses: dict[str, WordStatus]
    mastered_words: int
    total_words: int
    practice_complete: bool
    completion_message: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "message": self.message,
            "correction": self.correction,
            "grammarOk": self.grammar_ok,
            "correctWords": self.correct_words,
            "incorrectWords": self.incorrect_words,
            "missingWords": self.missing_words,
            "wordStatuses": self.word_statuses,
            "masteredWords": self.mastered_words,
            "totalWords": self.total_words,
            "practiceComplete": self.practice_complete,
            "completionMessage": self.completion_message,
        }


class DialoguePractice:
    def __init__(self, target_words: list[str], user_description: str, english_level: str):
        cleaned_words = [word.strip() for word in target_words if word and word.strip()]
        if not cleaned_words:
            raise ValueError("target_words must contain at least one non-empty word")

        self.target_words = cleaned_words
        self.user_description = (user_description or "").strip() or "(empty)"
        self.english_level = (english_level or "").strip() or "B1"
        self.word_statuses: dict[str, WordStatus] = {word: "unused" for word in self.target_words}

    def generate_round(self) -> DialogueRound:
        payload = self._chat_json(
            SCENARIO_PROMPT_TEMPLATE.format(
                user_description=self.user_description,
                target_words=", ".join(self.remaining_words()),
                english_level=self.english_level,
            ),
            temperature=0.6,
        )

        situation = str(payload.get("situation") or "").strip()
        question = str(payload.get("question") or "").strip()
        if not situation or not question:
            raise LLMError("LLM did not return a valid situation/question")

        return DialogueRound(
            situation=situation,
            question=question,
            target_words=self.remaining_words(),
        )

    def regenerate_question_for_situation(self, situation: str) -> str:
        fixed_situation = (situation or "").strip()
        if not fixed_situation:
            raise ValueError("situation must not be empty")

        payload = self._chat_json(
            QUESTION_FROM_SITUATION_PROMPT_TEMPLATE.format(
                situation=fixed_situation,
                target_words=", ".join(self.remaining_words()),
                english_level=self.english_level,
            ),
            temperature=0.5,
        )

        question = str(payload.get("question") or "").strip()
        if not question:
            raise LLMError("LLM did not return a valid question")

        return question

    def evaluate_answer(self, user_answer: str) -> DialogueFeedback:
        answer = (user_answer or "").strip()
        if not answer:
            raise ValueError("user_answer must not be empty")

        remaining = self.remaining_words()
        payload = self._chat_json(
            EVALUATION_PROMPT_TEMPLATE.format(
                target_words=", ".join(remaining),
                user_answer=answer,
                english_level=self.english_level,
            ),
            temperature=0.2,
        )

        correct_words = self._normalize_word_list(payload.get("correct_words"), remaining)
        incorrect_words = self._normalize_word_list(payload.get("incorrect_words"), remaining)
        missing_words = self._normalize_word_list(payload.get("missing_words"), remaining)

        for word in self.target_words:
            if self.word_statuses[word] == "correct":
                continue
            if word in correct_words:
                self.word_statuses[word] = "correct"
            elif word in incorrect_words:
                self.word_statuses[word] = "incorrect"

        mastered_words = sum(1 for status in self.word_statuses.values() if status == "correct")
        total_words = len(self.target_words)
        practice_complete = mastered_words == total_words

        status = str(payload.get("status") or "incorrect").strip().lower()
        if status not in {"correct", "incorrect"}:
            status = "incorrect"

        message = str(payload.get("message") or "").strip() or "Feedback generated."
        correction = str(payload.get("correction") or "").strip()
        grammar_ok = bool(payload.get("grammar_ok"))

        if practice_complete:
            completion_message = "Practice complete. You used all selected words correctly."
        else:
            completion_message = ""

        return DialogueFeedback(
            status=status,
            message=message,
            correction=correction,
            grammar_ok=grammar_ok,
            correct_words=correct_words,
            incorrect_words=incorrect_words,
            missing_words=missing_words,
            word_statuses=dict(self.word_statuses),
            mastered_words=mastered_words,
            total_words=total_words,
            practice_complete=practice_complete,
            completion_message=completion_message,
        )

    def remaining_words(self) -> list[str]:
        return [
            word
            for word in self.target_words
            if self.word_statuses[word] in {"unused", "incorrect"}
        ]

    def _normalize_word_list(self, raw_words: Any, candidates: list[str]) -> list[str]:
        if not isinstance(raw_words, list):
            return []

        candidate_map = {self._normalize_token(word): word for word in candidates}
        normalized: list[str] = []

        for raw_word in raw_words:
            norm = self._normalize_token(str(raw_word))
            canonical = candidate_map.get(norm)
            if canonical and canonical not in normalized:
                normalized.append(canonical)

        return normalized

    @staticmethod
    def _normalize_token(text: str) -> str:
        return "".join(char.lower() for char in text if char.isalnum())

    def _chat_json(self, prompt: str, temperature: float) -> dict[str, Any]:
        self._load_local_env()
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise LLMError("OPENAI_API_KEY is not set")

        request_payload = {
            "model": os.getenv("OPENAI_MODEL", DEFAULT_MODEL),
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
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
            with request.urlopen(req, timeout=45) as response:
                response_data = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            details = exc.read().decode("utf-8", errors="ignore")
            raise LLMError(f"OpenAI HTTP error {exc.code}: {details}") from exc
        except error.URLError as exc:
            raise LLMError(f"OpenAI connection error: {exc.reason}") from exc
        except TimeoutError as exc:
            raise LLMError("OpenAI request timed out") from exc

        choices = response_data.get("choices") or []
        if not choices:
            raise LLMError("OpenAI response has no choices")

        message = choices[0].get("message") or {}
        content = message.get("content")
        if not content:
            raise LLMError("OpenAI response has empty content")

        try:
            return json.loads(content)
        except json.JSONDecodeError as exc:
            raise LLMError("LLM did not return valid JSON") from exc

    @staticmethod
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
