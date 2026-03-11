import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CheckCircle2, MessageCircle, BookOpen, FileText } from "lucide-react";
import VocabCard from "./VocabCard";
import LearningTextModal from "./LearningTextModal";
import DialogueTraining from "./DialogueTraining";
import ThemeToggle from "./ThemeToggle";

interface WordData {
  word: string;
  domain: string;
  relevance: number;
  definition: string;
}

const initialWords: WordData[] = [
  {
    word: "Negotiate",
    domain: "General",
    relevance: 7,
    definition: "To discuss something in order to reach an agreement.",
  },
  {
    word: "Asynchronous",
    domain: "IT",
    relevance: 9,
    definition: "A communication method where operations occur independently, without waiting for others to finish.",
  },
  {
    word: "Containerization",
    domain: "IT",
    relevance: 8,
    definition: "Packaging software with its dependencies into isolated, portable containers for deployment.",
  },
  {
    word: "Protocol",
    domain: "General/IT",
    relevance: 7,
    definition: "A formal set of rules governing data transmission between systems or networks.",
  },
  {
    word: "Myocardial",
    domain: "Medicine",
    relevance: 6,
    definition: "Relating to the muscular tissue of the heart, the myocardium.",
  },
  {
    word: "Deployment",
    domain: "IT",
    relevance: 8,
    definition: "The process of releasing software to a production environment for end users.",
  },
];

type LearningMode = null | "chooser" | "text" | "dialogue";

interface DictionaryScreenProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const DictionaryScreen = ({ theme, toggleTheme }: DictionaryScreenProps) => {
  const [words, setWords] = useState<WordData[]>(initialWords);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [learningMode, setLearningMode] = useState<LearningMode>(null);
  const [dialogueWords, setDialogueWords] = useState<WordData[]>([]);

  useEffect(() => {
    const loadDictionary = async () => {
      try {
        const response = await fetch("/api/dictionary");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load dictionary");
        }

        if (Array.isArray(payload.words)) {
          setWords(payload.words);
        }
      } catch (error) {
        console.error("[Dictionary] Failed to load words", error);
      }
    };

    loadDictionary();
  }, []);

  const toggle = (word: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  };

  const handleMarkLearned = () => {
    setWords((prev) => prev.filter((w) => !selected.has(w.word)));
    setSelected(new Set());
  };

  const selectedWords = words.filter((w) => selected.has(w.word));

  // Dialogue training mode
  if (learningMode === "dialogue" && dialogueWords.length > 0) {
    return (
      <DialogueTraining
        words={dialogueWords.map((w) => ({ word: w.word, definition: w.definition }))}
        onExit={() => {
          setLearningMode(null);
          setDialogueWords([]);
          setSelected(new Set());
        }}
      />
    );
  }

  return (
    <>
      <div className="mx-auto max-w-lg px-5 pb-36 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">My Dictionary</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Select words to learn in batch.
            </p>
          </div>
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          {words.map((w) => (
            <VocabCard
              key={w.word}
              word={w.word}
              domain={w.domain}
              relevance={w.relevance}
              definition={w.definition}
              selected={selected.has(w.word)}
              onSelect={() => toggle(w.word)}
            />
          ))}
          {words.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="rounded-2xl glass p-8">
                <BookOpen size={36} className="text-muted-foreground/40 mx-auto" />
                <p className="mt-3 text-sm text-muted-foreground">All words marked as learned!</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Buttons */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="fixed bottom-[72px] left-0 right-0 z-40 flex justify-center gap-3 px-5 pb-3"
          >
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleMarkLearned}
              className="flex items-center gap-2 rounded-full glass px-6 py-3 text-[14px] font-semibold text-foreground transition-transform"
            >
              <CheckCircle2 size={16} />
              Mark as Learned
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setLearningMode("chooser")}
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-[14px] font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform"
            >
              <Sparkles size={16} />
              Learn Words
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Learning Method Chooser Modal */}
      <AnimatePresence>
        {learningMode === "chooser" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center px-5"
            onClick={() => setLearningMode(null)}
          >
            <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative z-10 w-full max-w-sm rounded-2xl glass-modal p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-foreground text-center">Choose Learning Method</h2>
              <p className="mt-1 text-sm text-muted-foreground text-center">
                {selected.size} word{selected.size > 1 ? "s" : ""} selected
              </p>

              <div className="mt-5 flex flex-col gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setLearningMode("text")}
                  className="flex items-center gap-4 rounded-2xl glass p-5 text-left transition-all hover:shadow-md"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                    <FileText size={22} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Generate Text</p>
                    <p className="text-[13px] text-muted-foreground">Read words in natural context</p>
                  </div>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setDialogueWords(selectedWords);
                    setLearningMode("dialogue");
                  }}
                  className="flex items-center gap-4 rounded-2xl glass p-5 text-left transition-all hover:shadow-md"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                    <MessageCircle size={22} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Learn in Dialogue</p>
                    <p className="text-[13px] text-muted-foreground">Practice words in conversation</p>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <LearningTextModal open={learningMode === "text"} onClose={() => { setLearningMode(null); setSelected(new Set()); }} />
    </>
  );
};

export default DictionaryScreen;
