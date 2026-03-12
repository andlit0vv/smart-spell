from deep_translator import GoogleTranslator


class TranslationError(Exception):
    pass


def translate_word_to_russian(word: str) -> str:
    normalized_word = word.strip()
    if not normalized_word:
        raise TranslationError("word is required")

    try:
        translated = GoogleTranslator(source="en", target="ru").translate(normalized_word)
    except Exception as exc:
        raise TranslationError(f"Translation request failed: {exc}") from exc

    if not translated:
        raise TranslationError("Translation service returned empty result")

    return translated.strip()
