from dataclasses import dataclass
from typing import Any


class LLMValidationError(Exception):
    pass


@dataclass
class TermAnalysis:
    term: str
    relevance: int
    definition: str
    examples: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "term": self.term,
            "relevance": self.relevance,
            "definition": self.definition,
            "examples": self.examples,
        }


def validate_analysis_response(term: str, payload: dict[str, Any]) -> TermAnalysis:
    raw_relevance = payload.get("relevance")
    if isinstance(raw_relevance, float):
        relevance = int(round(raw_relevance))
    elif isinstance(raw_relevance, int):
        relevance = raw_relevance
    else:
        raise LLMValidationError("LLM response has invalid relevance")

    relevance = max(0, min(10, relevance))

    definition = (payload.get("definition") or "").strip()
    if not definition:
        raise LLMValidationError("LLM response has empty definition")

    raw_examples = payload.get("examples")
    if not isinstance(raw_examples, list):
        raise LLMValidationError("LLM response has invalid examples")

    examples = [str(example).strip() for example in raw_examples if str(example).strip()]
    if len(examples) < 2:
        raise LLMValidationError("LLM response requires at least 2 examples")

    analyzed_term = (payload.get("term") or term).strip()

    return TermAnalysis(
        term=analyzed_term,
        relevance=relevance,
        definition=definition,
        examples=examples,
    )
