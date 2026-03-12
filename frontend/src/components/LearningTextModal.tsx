import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RefreshCw, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Props {
  open: boolean;
  selectedWords: string[];
  onClose: () => void;
}

interface WordAnalysisCard {
  word: string;
  definition: string;
  relevance: number;
  examples: string[];
  translationRu: string;
  isInDictionary: boolean;
}

const normalizeStem = (word: string) => {
  let stem = word.toLowerCase().trim();
  const suffixes = [
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
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of suffixes) {
      if (stem.length - suffix.length < 4) continue;
      if (stem.endsWith(suffix)) {
        stem = stem.slice(0, -suffix.length);
        changed = true;
        break;
      }
    }
  }

  return stem;
};

const ReadingText = ({ text, stems, words }: { text: string; stems: Set<string>; words: Set<string> }) => {
  const parts = text.split(/(\s+)/);

  return (
    <p className="text-[15px] leading-relaxed text-foreground/85 select-text">
      {parts.map((part, index) => {
        if (/^\s+$/.test(part)) return <span key={`${part}-${index}`}>{part}</span>;

        const clean = part.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "");
        const lower = clean.toLowerCase();
        const stem = normalizeStem(lower);
        const isTargetWord = words.has(lower) || (stem.length >= 4 && stems.has(stem));

        if (!isTargetWord) return <span key={`${part}-${index}`}>{part}</span>;

        return (
          <strong key={`${part}-${index}`} className="font-bold text-black dark:text-white">
            {part}
          </strong>
        );
      })}
    </p>
  );
};

const LearningTextModal = ({ open, selectedWords, onClose }: Props) => {
  const [allowWordForms, setAllowWordForms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [storyPrompt, setStoryPrompt] = useState("");
  const [analysisCard, setAnalysisCard] = useState<WordAnalysisCard | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [dictionaryLoading, setDictionaryLoading] = useState(false);

  const targetWordsSet = useMemo(
    () => new Set(selectedWords.map((word) => word.toLowerCase())),
    [selectedWords],
  );
  const targetStems = useMemo(
    () => new Set(selectedWords.map((word) => normalizeStem(word)).filter((stem) => stem.length >= 4)),
    [selectedWords],
  );

  const generateText = async () => {
    if (!selectedWords.length) return;
    setLoading(true);
    setError("");
    setAnalysisCard(null);
    setAnalysisError("");

    try {
      const response = await fetch("/api/reading/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_words: selectedWords,
          allow_word_forms: allowWordForms,
          story_prompt: storyPrompt.trim() || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to generate reading text");

      setText(payload.text || "");
    } catch (err) {
      console.error("[Reading] Failed to generate text", err);
      setError("Could not generate text. Please try again.");
      setText("");
    } finally {
      setLoading(false);
    }
  };

  const checkWordInDictionary = async (word: string) => {
    const response = await fetch("/api/dictionary");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Failed to load dictionary");
    }

    const existingWords = Array.isArray(payload.words) ? payload.words : [];
    return existingWords.some((item: { word?: string }) => item.word?.toLowerCase() === word.toLowerCase());
  };

  const requestWordAnalysis = async (selectedText: string) => {
    const normalizedSelection = selectedText.replace(/\s+/g, " ").trim();
    if (!normalizedSelection) return;

    setAnalysisLoading(true);
    setAnalysisError("");

    try {
      const response = await fetch("/api/translation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ word: normalizedSelection }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Backend request failed");
      }

      const analysis = payload.analysis;
      if (!analysis) {
        throw new Error("Backend returned no analysis");
      }

      const isInDictionary = await checkWordInDictionary(analysis.term || normalizedSelection);

      setAnalysisCard({
        word: analysis.term || normalizedSelection,
        definition: analysis.definition,
        relevance: typeof analysis.relevance === "number" ? analysis.relevance : 0,
        examples: Array.isArray(analysis.examples) ? analysis.examples : [],
        translationRu: typeof payload.translationRu === "string" ? payload.translationRu : "",
        isInDictionary,
      });
    } catch (requestError) {
      setAnalysisError(requestError instanceof Error ? requestError.message : "Cannot analyze selected text");
      setAnalysisCard(null);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString() || "";

    if (!selectedText.trim()) return;

    void requestWordAnalysis(selectedText);
    selection?.removeAllRanges();
  };

  const handleDictionaryAction = async () => {
    if (!analysisCard) return;

    setDictionaryLoading(true);
    setAnalysisError("");

    try {
      const response = await fetch("/api/dictionary", {
        method: analysisCard.isInDictionary ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          word: analysisCard.word,
          definition: analysisCard.definition,
          relevance: analysisCard.relevance,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Dictionary update failed");
      }

      setAnalysisCard((prev) => (prev ? { ...prev, isInDictionary: !prev.isInDictionary } : prev));
    } catch (dictionaryError) {
      setAnalysisError(dictionaryError instanceof Error ? dictionaryError.message : "Cannot update dictionary");
    } finally {
      setDictionaryLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-background"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="relative mx-auto flex h-full max-w-lg flex-col px-5 pt-6"
          >
            <h1 className="text-xl font-bold tracking-tight text-foreground">Generated Learning Text</h1>

            <div className="mt-4 rounded-2xl glass p-4">
              <p className="text-sm font-semibold text-foreground">Generate Text</p>
              <label className="mt-3 block text-xs text-muted-foreground" htmlFor="story-prompt">
                Optional story idea
              </label>
              <input
                id="story-prompt"
                value={storyPrompt}
                onChange={(event) => setStoryPrompt(event.target.value)}
                placeholder="e.g., A travel story in the mountains"
                className="mt-1 w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
              />

              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/40 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-foreground/85">Allow different word forms</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Example: <span className="text-foreground/70">write</span> → <span className="text-foreground/70">writing</span>
                  </p>
                </div>
                <Switch checked={allowWordForms} onCheckedChange={setAllowWordForms} />
              </div>

              <button
                onClick={generateText}
                disabled={loading || selectedWords.length === 0}
                className="mt-4 w-full rounded-xl bg-primary btn-primary-glow px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {loading ? (
                  "Generating..."
                ) : text ? (
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw size={14} />
                    Re-generate Text
                  </span>
                ) : (
                  "Generate Text"
                )}
              </button>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto pb-40">
              {error && <p className="text-sm text-red-500">{error}</p>}
              {!error && !text && !loading && (
                <p className="text-sm text-muted-foreground">Select options and generate a reading text.</p>
              )}
              {text && (
                <div onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
                  <ReadingText text={text} stems={targetStems} words={targetWordsSet} />
                </div>
              )}
            </div>

            <div className="pb-8 pt-4">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="flex w-full items-center justify-center gap-2 rounded-2xl glass py-3 text-sm font-semibold text-foreground transition-colors"
              >
                <ArrowLeft size={16} />
                Back to Dictionary
              </motion.button>
            </div>

            <AnimatePresence>
              {(analysisLoading || analysisError || analysisCard) && (
                <motion.div
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 24, opacity: 0 }}
                  className="absolute bottom-24 left-5 right-5 z-20 rounded-2xl glass-modal p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {analysisLoading ? "Analyzing..." : analysisCard?.word || "Selection details"}
                      </p>
                      {!analysisLoading && analysisCard?.translationRu && (
                        <p className="text-xs text-muted-foreground">{analysisCard.translationRu}</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setAnalysisCard(null);
                        setAnalysisError("");
                      }}
                      className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted btn-secondary-glass"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {analysisError && <p className="mt-2 text-xs text-red-500">{analysisError}</p>}

                  {!analysisLoading && analysisCard && (
                    <>
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-foreground/85">{analysisCard.definition}</p>
                      {analysisCard.examples.length > 0 && (
                        <p className="mt-2 line-clamp-2 text-[11px] italic text-muted-foreground">{analysisCard.examples[0]}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-medium text-muted-foreground">Relevance: {analysisCard.relevance}/10</span>
                        <button
                          onClick={handleDictionaryAction}
                          disabled={dictionaryLoading}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
                            analysisCard.isInDictionary ? "bg-red-500" : "bg-orange-500"
                          }`}
                        >
                          {dictionaryLoading
                            ? "..."
                            : analysisCard.isInDictionary
                              ? "Delete"
                              : "Add"}
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LearningTextModal;
