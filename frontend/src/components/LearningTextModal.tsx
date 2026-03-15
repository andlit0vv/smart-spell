import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import SelectionAnalysisCard, { type WordAnalysisCard } from "@/components/SelectionAnalysisCard";
import { apiFetch, notifyDictionaryUpdated } from "@/lib/api";

interface Props {
  open: boolean;
  selectedWords: string[];
  onClose: () => void;
}

const normalizeStem = (word: string) => {
  let stem = word.toLowerCase().trim();
  const suffixes = [
    "ization", "isation", "ational", "ation", "ition", "ment", "ness", "ingly", "edly", "izing", "ising", "ized", "ised", "ing", "ed", "ize", "ise", "izer", "iser", "ly", "ity", "ty", "al", "ic", "er", "or", "s",
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

const findSentenceContainingSelection = (text: string, selection: string) => {
  const normalizedSelection = selection.trim();
  if (!normalizedSelection) return "";

  const searchIndex = text.toLowerCase().indexOf(normalizedSelection.toLowerCase());
  if (searchIndex === -1) return "";

  const before = text.slice(0, searchIndex);
  const after = text.slice(searchIndex + normalizedSelection.length);

  const leftBoundary = Math.max(before.lastIndexOf("."), before.lastIndexOf("!"), before.lastIndexOf("?"));
  const rightCandidates = [after.indexOf("."), after.indexOf("!"), after.indexOf("?")].filter((i) => i >= 0);
  const rightBoundary = rightCandidates.length ? Math.min(...rightCandidates) : -1;

  const start = leftBoundary >= 0 ? leftBoundary + 1 : 0;
  const end = rightBoundary >= 0 ? searchIndex + normalizedSelection.length + rightBoundary + 1 : text.length;
  return text.slice(start, end).replace(/\s+/g, " ").trim();
};

const renderTargetWords = (rawText: string, stems: Set<string>, words: Set<string>, keyPrefix: string) => {
  const parts = rawText.split(/(\s+)/);
  return parts.map((part, index) => {
    if (/^\s+$/.test(part)) return <span key={`${keyPrefix}-${index}`}>{part}</span>;

    const clean = part.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "");
    const lower = clean.toLowerCase();
    const stem = normalizeStem(lower);
    const isTargetWord = words.has(lower) || (stem.length >= 4 && stems.has(stem));

    if (!isTargetWord) return <span key={`${keyPrefix}-${index}`}>{part}</span>;

    return (
      <strong key={`${keyPrefix}-${index}`} className="font-bold text-black dark:text-white">
        {part}
      </strong>
    );
  });
};

const ReadingText = ({ text, stems, words, highlightedSelection }: { text: string; stems: Set<string>; words: Set<string>; highlightedSelection: string }) => {
  const normalizedHighlight = highlightedSelection.trim();
  const highlightIndex = normalizedHighlight ? text.toLowerCase().indexOf(normalizedHighlight.toLowerCase()) : -1;

  if (highlightIndex < 0) {
    return <p className="select-text text-[15px] leading-relaxed text-foreground/85">{renderTargetWords(text, stems, words, "plain")}</p>;
  }

  const before = text.slice(0, highlightIndex);
  const selection = text.slice(highlightIndex, highlightIndex + normalizedHighlight.length);
  const after = text.slice(highlightIndex + normalizedHighlight.length);

  return (
    <p className="select-text text-[15px] leading-relaxed text-foreground/85">
      {renderTargetWords(before, stems, words, "before")}
      <mark className="rounded-md bg-primary/35 px-1 py-0.5 text-foreground shadow-inner shadow-primary/25">
        {renderTargetWords(selection, stems, words, "selected")}
      </mark>
      {renderTargetWords(after, stems, words, "after")}
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
  const [highlightedSelection, setHighlightedSelection] = useState("");
  const [controlsCollapsed, setControlsCollapsed] = useState(false);

  const targetWordsSet = useMemo(() => new Set(selectedWords.map((word) => word.toLowerCase())), [selectedWords]);
  const targetStems = useMemo(() => new Set(selectedWords.map((word) => normalizeStem(word)).filter((stem) => stem.length >= 4)), [selectedWords]);

  const generateText = async () => {
    if (!selectedWords.length) return;
    setLoading(true);
    setError("");
    setAnalysisCard(null);
    setAnalysisError("");
    setHighlightedSelection("");

    try {
      const response = await apiFetch("/api/reading/generate", {
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
      setControlsCollapsed(true);
    } catch (err) {
      console.error("[Reading] Failed to generate text", err);
      setError("Could not generate text. Please try again.");
      setText("");
    } finally {
      setLoading(false);
    }
  };

  const checkWordInDictionary = async (word: string) => {
    const response = await apiFetch("/api/dictionary");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Failed to load dictionary");
    const existingWords = Array.isArray(payload.words) ? payload.words : [];
    return existingWords.some((item: { word?: string }) => item.word?.toLowerCase() === word.toLowerCase());
  };

  const requestWordAnalysis = async (selectedText: string, contextSentence: string) => {
    const normalizedSelection = selectedText.replace(/\s+/g, " ").trim();
    if (!normalizedSelection) return;

    setAnalysisLoading(true);
    setAnalysisError("");

    try {
      const response = await apiFetch("/api/translation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          word: normalizedSelection,
          context_sentence: contextSentence,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Backend request failed");

      const analysis = payload.analysis;
      if (!analysis) throw new Error("Backend returned no analysis");

      const resolvedWord = analysis.term || normalizedSelection;
      const isInDictionary = await checkWordInDictionary(resolvedWord);

      setAnalysisCard({
        word: resolvedWord,
        definition: analysis.definition,
        relevance: typeof analysis.relevance === "number" ? analysis.relevance : 0,
        examples: Array.isArray(analysis.examples) ? analysis.examples : [],
        translationRu: typeof analysis.translationRu === "string" ? analysis.translationRu : "",
        isInDictionary,
        contextSentence,
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
    const normalized = selectedText.replace(/\s+/g, " ").trim();
    if (!normalized) return;

    setHighlightedSelection(normalized);
    const contextSentence = findSentenceContainingSelection(text, normalized);
    void requestWordAnalysis(normalized, contextSentence);
    selection?.removeAllRanges();
  };

  const handleDictionaryAction = async () => {
    if (!analysisCard) return;

    setDictionaryLoading(true);
    setAnalysisError("");

    try {
      const response = await apiFetch("/api/dictionary", {
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
      if (!response.ok) throw new Error(payload.error || "Dictionary update failed");

      notifyDictionaryUpdated();
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="relative z-10 mx-auto flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl glass-modal-strong px-5 pt-6"
          >
            <h1 className="text-xl font-bold tracking-tight text-foreground">Generated Learning Text</h1>

            <div className="mt-4 rounded-2xl glass p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Generate Text</p>
                <button
                  type="button"
                  onClick={() => setControlsCollapsed((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background/50 px-2 py-1 text-xs font-semibold text-muted-foreground"
                >
                  {controlsCollapsed ? "Expand" : "Collapse"}
                  {controlsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </div>

              {controlsCollapsed ? (
                <button
                  onClick={generateText}
                  disabled={loading || selectedWords.length === 0}
                  className="mt-3 w-full rounded-xl bg-primary btn-primary-glow px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw size={18} className="animate-spin" />
                      Generating...
                    </span>
                  ) : (
                    "Regenerate Text"
                  )}
                </button>
              ) : (
                <>
                  <label className="mt-3 block text-xs text-muted-foreground" htmlFor="story-prompt">Optional story idea</label>
                  <input
                    id="story-prompt"
                    value={storyPrompt}
                    onChange={(event) => setStoryPrompt(event.target.value)}
                    placeholder="e.g., A travel story in the mountains"
                    className="mt-1 w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
                  />

                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/40 px-3 py-2">
                    <p className="text-sm font-semibold text-foreground">Allow different word forms</p>
                    <Switch checked={allowWordForms} onCheckedChange={setAllowWordForms} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">Example writing, write and writing.</p>

                  <button
                    onClick={generateText}
                    disabled={loading || selectedWords.length === 0}
                    className="mt-4 w-full rounded-xl bg-primary btn-primary-glow px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <RefreshCw size={18} className="animate-spin" />
                        Generating...
                      </span>
                    ) : text ? (
                      <span className="inline-flex items-center gap-2">
                        <RefreshCw size={16} />
                        Re-generate Text
                      </span>
                    ) : (
                      "Generate Text"
                    )}
                  </button>
                </>
              )}
            </div>

            <div className="mt-3 overflow-y-auto pb-4">
              {error && <p className="text-sm text-red-500">{error}</p>}
              {!error && !text && !loading && (
                <div className="flex min-h-[48px] items-center justify-center">
                  <p className="text-center text-sm text-muted-foreground">Select options and generate a reading text.</p>
                </div>
              )}
              {text && (
                <div className="mx-auto w-full max-w-[780px]" onMouseUp={handleTextSelection} onTouchEnd={handleTextSelection}>
                  <ReadingText text={text} stems={targetStems} words={targetWordsSet} highlightedSelection={highlightedSelection} />
                </div>
              )}
            </div>

            <div className="pb-6 pt-3">
              <motion.button whileTap={{ scale: 0.97 }} onClick={onClose} className="flex w-full items-center justify-center gap-2 rounded-2xl glass py-3 text-sm font-semibold text-foreground transition-colors">
                <ArrowLeft size={16} />
                Back to Dictionary
              </motion.button>
            </div>

            <SelectionAnalysisCard
              analysisCard={analysisCard}
              analysisLoading={analysisLoading}
              analysisError={analysisError}
              dictionaryLoading={dictionaryLoading}
              onClose={() => {
                setAnalysisCard(null);
                setAnalysisError("");
              }}
              onDictionaryAction={() => void handleDictionaryAction()}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LearningTextModal;
