import { useState } from "react";
import { ArrowRight, Languages, BarChart3, FileText, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";

interface TranslationScreenProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

interface WordResult {
  word: string;
  definition: string;
  relevance: number;
  examples: string[];
}

const TranslationScreen = ({ theme, toggleTheme }: TranslationScreenProps) => {
  const [word, setWord] = useState("");
  const [result, setResult] = useState<WordResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!word.trim()) return;
    const inputWord = word.trim();

    setConnectionError(null);
    setConnectionMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/translation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ word: inputWord }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Backend request failed");
      }

      const analysis = payload.analysis;
      if (!analysis) {
        throw new Error("Backend returned no analysis");
      }

      setResult({
        word: analysis.term || inputWord,
        definition: analysis.definition,
        relevance: typeof analysis.relevance === "number" ? analysis.relevance : 0,
        examples: Array.isArray(analysis.examples) ? analysis.examples : [],
      });
      setConnectionMessage("Analysis received from backend");
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Cannot connect to backend");
      setResult(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setResult(null);
    setWord("");
  };

  const handleAdd = () => {
    const saveWord = async () => {
      if (!result) return;

      setConnectionError(null);
      setConnectionMessage(null);

      try {
        const response = await fetch("/api/dictionary", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            word: result.word,
            definition: result.definition,
            relevance: result.relevance,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to save word");
        }

        setConnectionMessage("Word added to dictionary");
        setResult(null);
        setWord("");
      } catch (error) {
        setConnectionError(error instanceof Error ? error.message : "Cannot connect to backend");
      }
    };

    void saveWord();
  };

  return (
    <div className="mx-auto max-w-lg px-5 pb-36 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Translation</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter a word to translate and add to your dictionary.</p>
        </div>
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      </div>

      <div className="mt-5 flex gap-2.5">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Type a word…"
          className="flex-1 rounded-2xl glass px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        />
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform"
        >
          <span className="hidden sm:inline">{isSubmitting ? "Sending..." : "Enter a Word"}</span>
          <ArrowRight size={18} />
        </motion.button>
      </div>

      {connectionMessage ? (
        <p className="mt-3 text-sm text-emerald-500">{connectionMessage}</p>
      ) : null}
      {connectionError ? (
        <p className="mt-3 text-sm text-red-500">{connectionError}</p>
      ) : null}

      <AnimatePresence mode="wait">
        {result ? (
          <motion.div
            key={result.word}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="mt-6 rounded-2xl glass p-5"
          >
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-bold text-foreground">{result.word}</h2>
              <span
                aria-label="No category yet"
                title="Add category after saving"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-600/60 text-zinc-200"
              >
                <Plus size={12} />
              </span>
            </div>

            <p className="mt-3 text-[14px] leading-relaxed text-foreground/80">{result.definition}</p>

            <div className="mt-4 flex items-center gap-2">
              <BarChart3 size={14} className="text-primary" />
              <span className="text-[13px] font-medium text-muted-foreground">Relevance</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted ml-1">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${result.relevance * 10}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
              <span className="text-sm font-bold text-foreground">{result.relevance}/10</span>
            </div>

            <div className="mt-4 rounded-xl bg-muted/50 p-3.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText size={12} className="text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Example</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[13px] italic leading-relaxed text-foreground/75">
                {result.examples.map((example, index) => (
                  <li key={`${result.word}-${index}`}>{example}</li>
                ))}
              </ul>
            </div>

            {/* Skip / Add buttons */}
            <div className="flex gap-3 mt-5">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSkip}
                className="flex-1 rounded-xl glass py-2.5 text-[14px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Skip
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleAdd}
                className="flex-1 rounded-xl bg-primary py-2.5 text-[14px] font-semibold text-primary-foreground shadow-md shadow-primary/15 transition-all"
              >
                Add
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-10 flex flex-col items-center justify-center py-12 text-center"
          >
            <div className="rounded-2xl glass p-5">
              <Languages size={36} className="text-muted-foreground/40 mx-auto" />
              <p className="mt-3 text-sm text-muted-foreground">Enter a word above to get started</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TranslationScreen;
