import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw, Send, RefreshCw, GraduationCap, Pencil } from "lucide-react";
import SelectionAnalysisCard, { type WordAnalysisCard } from "@/components/SelectionAnalysisCard";
import { apiFetch, notifyDictionaryUpdated } from "@/lib/api";

interface WordInfo {
  word: string;
  definition: string;
}

interface DialogueTrainingProps {
  words: WordInfo[];
  onExit: () => void;
  onFinishPractice: (markAsLearned: boolean, learnedWords: string[]) => void;
  targetCategory?: string;
}

interface PracticeState {
  target_words: string[];
  word_status: Record<string, "unused" | "correct" | "incorrect">;
  correct_count: number;
  total_words: number;
}

const findSentenceContainingSelection = (text: string, selection: string) => {
  const normalizedSelection = selection.trim();
  if (!normalizedSelection) return "";

  const searchIndex = text.toLowerCase().indexOf(normalizedSelection.toLowerCase());
  if (searchIndex === -1) return text.trim();

  const before = text.slice(0, searchIndex);
  const after = text.slice(searchIndex + normalizedSelection.length);

  const leftBoundary = Math.max(before.lastIndexOf("."), before.lastIndexOf("!"), before.lastIndexOf("?"));
  const rightCandidates = [after.indexOf("."), after.indexOf("!"), after.indexOf("?")].filter((i) => i >= 0);
  const rightBoundary = rightCandidates.length ? Math.min(...rightCandidates) : -1;

  const start = leftBoundary >= 0 ? leftBoundary + 1 : 0;
  const end = rightBoundary >= 0 ? searchIndex + normalizedSelection.length + rightBoundary + 1 : text.length;
  return text.slice(start, end).replace(/\s+/g, " ").trim();
};

const DialogueTraining = ({ words, onExit, onFinishPractice, targetCategory }: DialogueTrainingProps) => {
  const targetWords = useMemo(() => words.map((item) => item.word), [words]);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [level, setLevel] = useState("B1");
  const [userDescription, setUserDescription] = useState("English learner");
  const [loading, setLoading] = useState(false);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [questionLoading, setQuestionLoading] = useState(false);

  const [situation, setSituation] = useState("");
  const [initialSituation, setInitialSituation] = useState("");
  const [question, setQuestion] = useState("");
  const [isEditingSituation, setIsEditingSituation] = useState(false);
  const [answer, setAnswer] = useState("");
  const [state, setState] = useState<PracticeState>({
    target_words: targetWords,
    word_status: Object.fromEntries(targetWords.map((word) => [word, "unused"])),
    correct_count: 0,
    total_words: targetWords.length,
  });
  const [feedback, setFeedback] = useState<{ message: string; correction: string }>({
    message: "",
    correction: "",
  });
  const [complete, setComplete] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

  const [analysisCard, setAnalysisCard] = useState<WordAnalysisCard | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [dictionaryLoading, setDictionaryLoading] = useState(false);

  const learnedWords = useMemo(
    () => Object.entries(state.word_status)
      .filter(([, status]) => status === "correct")
      .map(([word]) => word),
    [state.word_status],
  );

  const progress = state.total_words > 0 ? (state.correct_count / state.total_words) * 100 : 0;

  const loadProfile = async () => {
    try {
      const response = await apiFetch("/api/profile");
      const payload = await response.json();
      if (response.ok && payload.profile) {
        if (payload.profile.englishLevel) setLevel(payload.profile.englishLevel);
        if (payload.profile.bio) setUserDescription(payload.profile.bio);
      }
    } catch (error) {
      console.error("[Dialogue] Failed to load profile", error);
    }
  };

  const generateScenario = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/dialog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practice_id: practiceId,
          user_description: userDescription,
          level,
          target_words: targetWords,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to generate scenario");

      setPracticeId(payload.practice_id);
      setSituation(payload.situation || "");
      setInitialSituation(payload.situation || "");
      setQuestion(payload.question || "");
      setIsEditingSituation(false);
      if (payload.practice_state) setState(payload.practice_state);
      setFeedback({ message: "", correction: "" });
      setAnswer("");
      setHighlightedSelection("");
    } catch (error) {
      console.error("[Dialogue] Generate failed", error);
      setFeedback({ message: "Could not generate a situation. Please try again.", correction: "" });
    } finally {
      setLoading(false);
    }
  };

  const regenerateQuestion = async (force = false) => {
    if (!situation.trim()) return;
    if (!force && situation === initialSituation) return;
    setQuestionLoading(true);
    try {
      const response = await apiFetch("/api/dialog/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation, target_words: targetWords, level, previous_question: question }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to regenerate question");
      setQuestion(payload.question || "");
      setInitialSituation(situation);
      setIsEditingSituation(false);
    } catch (error) {
      console.error("[Dialogue] Question generation failed", error);
    } finally {
      setQuestionLoading(false);
    }
  };

  const restartPractice = () => {
    setPracticeId(null);
    setState({
      target_words: targetWords,
      word_status: Object.fromEntries(targetWords.map((word) => [word, "unused"])),
      correct_count: 0,
      total_words: targetWords.length,
    });
    setFeedback({ message: "", correction: "" });
    setAnswer("");
    setComplete(false);
    setHighlightedSelection("");
  };

  const nextQuestion = async () => {
    if (!situation.trim()) {
      await generateScenario();
      return;
    }
    await regenerateQuestion(true);
  };

  const checkAnswer = async () => {
    if (!answer.trim()) return;
    setAnswerLoading(true);
    try {
      const response = await apiFetch("/api/dialog/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practice_id: practiceId,
          answer,
          target_words: targetWords,
          level,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to check answer");

      if (payload.practice_state) setState(payload.practice_state);
      setPracticeId(payload.practice_id);
      setFeedback({ message: payload.message || "", correction: payload.correction || "" });
      setComplete(Boolean(payload.is_complete));
    } catch (error) {
      console.error("[Dialogue] Check failed", error);
      setFeedback({ message: "Could not check your answer. Please retry.", correction: "" });
    } finally {
      setAnswerLoading(false);
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

  const handleSelectionFromText = (sourceText: string) => {
    const selection = window.getSelection();
    const selectedText = selection?.toString() || "";
    const normalized = selectedText.replace(/\s+/g, " ").trim();
    if (!normalized) return;

    const contextSentence = findSentenceContainingSelection(sourceText, normalized);
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
        headers: { "Content-Type": "application/json" },
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

  useEffect(() => {
    const run = async () => {
      await loadProfile();
      await generateScenario();
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative mx-auto max-w-lg px-5 pb-36 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onExit} className="flex h-10 w-10 items-center justify-center rounded-xl glass">
          <ArrowLeft size={18} className="text-foreground" />
        </motion.button>
        <h1 className="text-lg font-bold text-foreground">Dialogue Practice</h1>
      </div>

      <div className="mb-4 text-sm text-muted-foreground">
        {targetCategory ? <span><strong>Target category:</strong> {targetCategory}</span> : <span><strong>Target words:</strong> {targetWords.join(", ")}</span>}
      </div>

      <div className="mb-3 rounded-2xl glass-dialogue p-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Situation</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsEditingSituation((prev) => !prev)} className="text-primary" aria-label="Edit situation"><Pencil size={16} /></button>
            <button onClick={generateScenario} className="text-primary" aria-label="Refresh situation"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
          </div>
        </div>
        <textarea
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          onBlur={() => void regenerateQuestion()}
          onMouseUp={() => handleSelectionFromText(situation)}
          onTouchEnd={() => handleSelectionFromText(situation)}
          readOnly={!isEditingSituation}
          rows={3}
          className="w-full resize-none rounded-xl bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 read-only:opacity-80"
        />
      </div>

      <div className="mb-4 rounded-2xl glass-dialogue p-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Question</p>
          <button onClick={nextQuestion} disabled={questionLoading || loading} className="text-primary disabled:opacity-60" aria-label="Generate another question">
            <RefreshCw size={16} className={questionLoading ? "animate-spin" : ""} />
          </button>
        </div>
        <p className="select-text text-sm text-foreground" onMouseUp={() => handleSelectionFromText(question)} onTouchEnd={() => handleSelectionFromText(question)}>
          {questionLoading ? "Updating question..." : question}
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-[12px] font-medium text-muted-foreground">Your answer</label>
        <div className="relative">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Write your answer..."
            rows={4}
            className="w-full resize-none rounded-2xl glass-dialogue px-4 py-3 pr-12 text-[14px] text-foreground"
          />
          <button onClick={checkAnswer} disabled={answerLoading || !answer.trim()} className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">
            <Send size={14} />
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{state.correct_count} / {state.total_words} words mastered</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-4 rounded-2xl glass-dialogue p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary">Feedback</p>
        <p className="select-text text-sm text-foreground" onMouseUp={() => handleSelectionFromText(feedback.message)} onTouchEnd={() => handleSelectionFromText(feedback.message)}>
          {feedback.message || "Submit your answer to get feedback."}
        </p>
        {feedback.correction && (
          <p className="mt-2 select-text text-sm text-muted-foreground" onMouseUp={() => handleSelectionFromText(feedback.correction)} onTouchEnd={() => handleSelectionFromText(feedback.correction)}>
            Correction: {feedback.correction}
          </p>
        )}
      </div>

      {complete && (
        <div className="mt-4 rounded-2xl bg-green-500/10 p-4 text-sm text-green-700 dark:text-green-400">Practice complete. You used all selected words correctly.</div>
      )}

      <div className="mt-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={restartPractice} className="flex items-center justify-center gap-2 rounded-xl glass-dialogue px-4 py-3 text-sm font-semibold"><RotateCcw size={15} /> Start Over</button>
          <button onClick={() => setShowFinishModal(true)} className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"><GraduationCap size={15} /> Finish Practice</button>
        </div>
      </div>

      {showFinishModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-5" onClick={() => setShowFinishModal(false)}>
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-sm rounded-2xl glass-modal p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-center text-lg font-bold text-foreground">Do you want to save the progress?</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">Choose what to do with practiced words.</p>
            <div className="mt-5 space-y-2.5">
              <button
                onClick={() => {
                  setShowFinishModal(false);
                  onFinishPractice(false, []);
                }}
                className="w-full rounded-xl glass px-4 py-3 text-sm font-semibold text-foreground"
              >
                Keep words in dictionary
              </button>
              <button
                onClick={() => {
                  setShowFinishModal(false);
                  onFinishPractice(true, learnedWords);
                }}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
              >
                Mark words as learned
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};

export default DialogueTraining;
