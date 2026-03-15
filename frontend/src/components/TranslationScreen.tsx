import { useState } from "react";
import { ArrowRight, Languages, BarChart3, FileText, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiFetch, notifyDictionaryUpdated } from "@/lib/api";

interface TranslationScreenProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

interface WordResult {
  word: string;
  definition: string;
  relevance: number;
  examples: string[];
  translationRu: string;
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
      const response = await apiFetch("/api/translation", {
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
        translationRu: typeof analysis.translationRu === "string" ? analysis.translationRu : "",
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
        const response = await apiFetch("/api/dictionary", {
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
        notifyDictionaryUpdated();
        setResult(null);
        setWord("");
      } catch (error) {
        setConnectionError(error instanceof Error ? error.message : "Cannot connect to backend");
      }
    };

    void saveWord();
  };

  return (
    <div className="relative mx-auto max-w-lg px-5 pb-36 pt-6">
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
          className="flex items-center gap-2 rounded-2xl bg-primary btn-primary-glow px-5 py-3 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform"
        >
          <span className="hidden sm:inline">{isSubmitting ? "Sending..." : "Enter a Word"}</span>
          {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : <ArrowRight size={18} />}
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
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold text-foreground">{result.word}</h2>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="rounded-lg border border-border/60 bg-background/40 px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground">
                    Show translation
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-fit max-w-[220px] rounded-xl border-border/60 px-3 py-2 text-sm">
                  <p className="font-semibold text-foreground">{result.translationRu || "Перевод не найден"}</p>
                </PopoverContent>
              </Popover>
            </div>

            <p className="mt-3 text-[14px] leading-relaxed text-foreground/80">{result.definition}</p>

            <div className="mt-4 flex items-center gap-2">
              <BarChart3 size={14} className="text-primary" />
              <span className="text-[13px] font-medium text-muted-foreground">Relevance</span>
              <div className="ml-1 h-1.5 flex-1 rounded-full bg-muted">
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
              <div className="mb-1.5 flex items-center gap-1.5">
                <FileText size={12} className="text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Example</span>
              </div>
              <ul className="list-disc space-y-1 pl-4 text-[13px] italic leading-relaxed text-foreground/75">
                {result.examples.map((example, index) => (
                  <li key={`${result.word}-${index}`}>{example}</li>
                ))}
              </ul>
            </div>

            <div className="mt-5 flex gap-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSkip}
                className="flex-1 rounded-xl glass btn-secondary-glass py-2.5 text-[14px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Skip
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleAdd}
                className="flex-1 rounded-xl bg-primary btn-primary-glow py-2.5 text-[14px] font-semibold text-primary-foreground shadow-md shadow-primary/15 transition-all"
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
              <Languages size={36} className="mx-auto text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">Enter a word above to get started</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TranslationScreen;
