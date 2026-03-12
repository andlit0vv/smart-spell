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

interface WordCategory {
  name: string;
  color: string;
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

const CATEGORY_PALETTE = ["#5D6BFF", "#8B5CF6", "#2BA8FF", "#22C55E", "#D946EF", "#F97316", "#EAB308"];

const getColorFromName = (name: string) => {
  const hash = name
    .toLowerCase()
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
};

interface DictionaryScreenProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const DictionaryScreen = ({ theme, toggleTheme }: DictionaryScreenProps) => {
  const [words, setWords] = useState<WordData[]>(initialWords);
  const [wordCategories, setWordCategories] = useState<Record<string, WordCategory[]>>(() =>
    Object.fromEntries(
      initialWords.map((item) => {
        const categories = item.domain
          .split("/")
          .map((category) => category.trim())
          .filter(Boolean);

        return [
          item.word,
          categories.map((name) => ({
            name,
            color: getColorFromName(name),
          })),
        ];
      }),
    ),
  );
  const [availableCategories, setAvailableCategories] = useState<WordCategory[]>([
    { name: "General", color: getColorFromName("General") },
    { name: "IT", color: getColorFromName("IT") },
    { name: "Medicine", color: getColorFromName("Medicine") },
  ]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [learningMode, setLearningMode] = useState<LearningMode>(null);
  const [dialogueWords, setDialogueWords] = useState<WordData[]>([]);
  const [openCategoryWord, setOpenCategoryWord] = useState<string | null>(null);

  const getCategoryColor = (name: string) => {
    const existing = availableCategories.find((item) => item.name.toLowerCase() === name.toLowerCase());
    return existing?.color ?? getColorFromName(name);
  };

  useEffect(() => {
    const loadDictionary = async () => {
      try {
        const response = await fetch("/api/dictionary");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load dictionary");
        }

        if (Array.isArray(payload.words)) {
          const categorySet = new Set<string>();

          payload.words.forEach((item: WordData) => {
            item.domain
              .split("/")
              .map((category) => category.trim())
              .filter(Boolean)
              .forEach((category) => categorySet.add(category));
          });

          setAvailableCategories((prev) => {
            const existing = new Set(prev.map((item) => item.name.toLowerCase()));
            const additions = Array.from(categorySet)
              .filter((category) => !existing.has(category.toLowerCase()))
              .map((category) => ({ name: category, color: getColorFromName(category) }));

            return additions.length ? [...prev, ...additions] : prev;
          });

          setWords(payload.words);
          setWordCategories((prev) => {
            const next = { ...prev };

            payload.words.forEach((item: WordData) => {
              if (!next[item.word]) {
                const parsedCategories = item.domain
                  .split("/")
                  .map((category) => category.trim())
                  .filter(Boolean);

                next[item.word] = parsedCategories.map((name) => ({
                  name,
                  color: getCategoryColor(name),
                }));
              }
            });

            return next;
          });
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

  const handleDialogueFinish = (markAsLearned: boolean, learnedWords: string[]) => {
    if (markAsLearned) {
      const learnedSet = new Set(learnedWords);
      setWords((prev) => prev.filter((w) => !learnedSet.has(w.word)));
    }

    setLearningMode(null);
    setDialogueWords([]);
    setSelected(new Set());
  };

  const selectedWords = words.filter((w) => selected.has(w.word));

  const toggleCategoryForWord = (word: string, category: WordCategory) => {
    setWordCategories((prev) => {
      const current = prev[word] ?? [];
      const exists = current.some((item) => item.name === category.name);

      return {
        ...prev,
        [word]: exists
          ? current.filter((item) => item.name !== category.name)
          : [...current, category],
      };
    });
  };

  const createCategory = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setAvailableCategories((prev) => {
      if (prev.some((item) => item.name.toLowerCase() === trimmedName.toLowerCase())) {
        return prev;
      }

      return [...prev, { name: trimmedName, color: getColorFromName(trimmedName) }];
    });
  };

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
        onFinishPractice={handleDialogueFinish}
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
              categories={wordCategories[w.word] ?? []}
              availableCategories={availableCategories}
              selected={selected.has(w.word)}
              onSelect={() => toggle(w.word)}
              onCategoryToggle={(category) => toggleCategoryForWord(w.word, category)}
              onCategoryCreate={createCategory}
              isCategoryDropdownOpen={openCategoryWord === w.word}
              onCategoryDropdownChange={(open) => setOpenCategoryWord(open ? w.word : null)}
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
              className="flex items-center gap-2 rounded-full glass btn-secondary-glass px-6 py-3 text-[14px] font-semibold text-foreground transition-transform"
            >
              <CheckCircle2 size={16} />
              Mark as Learned
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setLearningMode("chooser")}
              className="flex items-center gap-2 rounded-full bg-primary btn-primary-glow px-6 py-3 text-[14px] font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform"
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
            <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative z-10 w-full max-w-sm rounded-2xl glass-modal-strong p-6"
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

      <LearningTextModal
        open={learningMode === "text"}
        selectedWords={selectedWords.map((item) => item.word)}
        onClose={() => { setLearningMode(null); setSelected(new Set()); }}
      />
    </>
  );
};

export default DictionaryScreen;
