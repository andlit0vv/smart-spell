import { useState } from "react";
import { ArrowRight, Languages, BarChart3, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";

interface TranslationScreenProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

interface WordResult {
  word: string;
  category: string;
  definition: string;
  relevance: number;
  example: string;
}

const mockResults: Record<string, WordResult> = {
  deployment: {
    word: "Deployment",
    category: "IT",
    definition: "The process of releasing and installing software applications, updates, or patches from a development environment to a production environment where end users can access them.",
    relevance: 8,
    example: "The team scheduled the deployment for midnight to minimize user disruption.",
  },
  asynchronous: {
    word: "Asynchronous",
    category: "IT",
    definition: "A method of communication or processing where operations occur independently of the main program flow, allowing tasks to execute without waiting for others to complete.",
    relevance: 9,
    example: "Asynchronous API calls improve the responsiveness of web applications.",
  },
  protocol: {
    word: "Protocol",
    category: "General/IT",
    definition: "A formal set of rules, conventions, or standards that govern how data is transmitted and received across networks or between computing systems.",
    relevance: 7,
    example: "HTTP is the primary protocol used for transferring web pages on the internet.",
  },
};

const TranslationScreen = ({ theme, toggleTheme }: TranslationScreenProps) => {
  const [word, setWord] = useState("");
  const [result, setResult] = useState<WordResult | null>(null);
  // Added request-state flag so the user sees that the word is being sent to backend.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Added success text from backend response to visibly confirm Frontend ↔ Backend connection.
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  // Added error text to explain when backend is down or request failed.
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!word.trim()) return;
    const inputWord = word.trim();

    // Reset old status before sending a new word.
    setConnectionError(null);
    setConnectionMessage(null);
    setIsSubmitting(true);

    try {
      // Added backend call: submit the typed word to Flask API for connection check.
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

      // Show backend confirmation message in UI.
      setConnectionMessage(payload.message || "Connected to backend");
    } catch (error) {
      // Show readable error when backend cannot be reached.
      setConnectionError(error instanceof Error ? error.message : "Cannot connect to backend");
    } finally {
      setIsSubmitting(false);
    }

    const key = inputWord.toLowerCase();
    const found = mockResults[key];
    if (found) {
      setResult(found);
    } else {
      setResult({
        word: inputWord,
        category: "General",
        definition: `A term referring to "${inputWord}" — look it up in a specialized dictionary for a detailed definition.`,
        relevance: 5,
        example: `The concept of ${inputWord} is widely discussed in professional literature.`,
      });
    }
  };

  const handleSkip = () => {
    setResult(null);
    setWord("");
  };

  const handleAdd = () => {
    // TODO: add word to dictionary
    setResult(null);
    setWord("");
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
          // Disable button while request is in-flight to prevent duplicate backend posts.
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform"
        >
          <span className="hidden sm:inline">{isSubmitting ? "Sending..." : "Enter a Word"}</span>
          <ArrowRight size={18} />
        </motion.button>
      </div>

      {/* Added success line so user can immediately see that backend acknowledged the word. */}
      {connectionMessage ? (
        <p className="mt-3 text-sm text-emerald-500">{connectionMessage}</p>
      ) : null}
      {/* Added error line so connectivity problems are visible without opening DevTools. */}
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
              <span className="inline-block rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                {result.category}
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
              <p className="text-[13px] italic leading-relaxed text-foreground/75">"{result.example}"</p>
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
