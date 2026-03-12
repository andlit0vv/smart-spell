import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CheckCircle2, MessageCircle, BookOpen, FileText, Plus, X } from "lucide-react";
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
  id: string;
  name: string;
  group: "topic";
}

interface DictionaryScreenProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

type LearningMode = null | "chooser" | "text" | "dialogue";

const initialWords: WordData[] = [
  { word: "Negotiate", domain: "General", relevance: 7, definition: "To discuss something in order to reach an agreement." },
  { word: "Asynchronous", domain: "IT", relevance: 9, definition: "A communication method where operations occur independently, without waiting for others to finish." },
  { word: "Containerization", domain: "IT", relevance: 8, definition: "Packaging software with its dependencies into isolated, portable containers for deployment." },
  { word: "Protocol", domain: "General/IT", relevance: 7, definition: "A formal set of rules governing data transmission between systems or networks." },
  { word: "Myocardial", domain: "Medicine", relevance: 6, definition: "Relating to the muscular tissue of the heart, the myocardium." },
  { word: "Deployment", domain: "IT", relevance: 8, definition: "The process of releasing software to a production environment for end users." },
];

const createCategoryId = (name: string, group: WordCategory["group"]) =>
  `${group}:${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

const groupFromDomain = (_domain: string): WordCategory["group"] => "topic";

const DictionaryScreen = ({ theme, toggleTheme }: DictionaryScreenProps) => {
  const [words, setWords] = useState<WordData[]>(initialWords);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [learningMode, setLearningMode] = useState<LearningMode>(null);
  const [dialogueWords, setDialogueWords] = useState<WordData[]>([]);

  const [categoriesById, setCategoriesById] = useState<Record<string, WordCategory>>({});
  const [wordCategoryIds, setWordCategoryIds] = useState<Record<string, string[]>>({});
  const [activeWord, setActiveWord] = useState<string | null>(null);

  const [filterGroup, setFilterGroup] = useState<"all" | "topic">("all");
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState("");

  useEffect(() => {
    const loadDictionary = async () => {
      try {
        const response = await fetch("/api/dictionary");
        const payload = await response.json();
        if (response.ok && Array.isArray(payload.words)) {
          setWords(payload.words);
        }
      } catch (error) {
        console.error("[Dictionary] Failed to load words", error);
      }
    };

    loadDictionary();
  }, []);

  useEffect(() => {
    const baseCategories: Record<string, WordCategory> = {};
    const assignments: Record<string, string[]> = {};

    words.forEach((item) => {
      const ids: string[] = [];
      item.domain
        .split("/")
        .map((category) => category.trim())
        .filter(Boolean)
        .forEach((name) => {
          const group = groupFromDomain(name);
          const id = createCategoryId(name, group);
          if (!baseCategories[id]) {
            baseCategories[id] = { id, name, group };
          }
          ids.push(id);
        });
      assignments[item.word] = Array.from(new Set(ids));
    });

    setCategoriesById((prev) => ({ ...baseCategories, ...prev }));
    setWordCategoryIds((prev) => ({ ...assignments, ...prev }));
  }, [words]);

  const allCategories = useMemo(() => Object.values(categoriesById), [categoriesById]);

  const visibleCategories = allCategories
    .filter((item) => (filterGroup === "all" ? true : item.group === filterGroup))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredWords = words.filter((word) => {
    if (categoryFilters.size === 0) return true;
    const ids = wordCategoryIds[word.word] ?? [];
    return ids.some((id) => categoryFilters.has(id));
  });

  const selectedWords = words.filter((w) => selected.has(w.word));

  const toggle = (word: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  };

  const toggleCategoryFilter = (categoryId: string) => {
    setCategoryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
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

  const toggleWordCategory = (word: string, categoryId: string) => {
    setWordCategoryIds((prev) => {
      const current = prev[word] ?? [];
      return {
        ...prev,
        [word]: current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId],
      };
    });
  };

  const createCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const id = createCategoryId(trimmed, "topic");
    setCategoriesById((prev) => {
      if (prev[id]) return prev;
      return { ...prev, [id]: { id, name: trimmed, group: "topic" } };
    });
    setNewCategoryName("");
  };

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
            <p className="mt-1 text-sm text-muted-foreground">Mobile-first categories by topics.</p>
          </div>
          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        </div>

        <div className="mt-5 rounded-2xl glass p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category filters</p>
            {categoryFilters.size > 0 && (
              <button type="button" onClick={() => setCategoryFilters(new Set())} className="text-xs font-semibold text-primary">
                Clear
              </button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl bg-background/40 p-1">
            {(["all", "topic"] as const).map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => setFilterGroup(group)}
                className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold capitalize ${filterGroup === group ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {group === "topic" ? "topics" : group}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {visibleCategories.map((category) => {
              const active = categoryFilters.has(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategoryFilter(category.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    active ? "border-primary bg-primary/20 text-primary" : "border-border/70 bg-background/50 text-muted-foreground"
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-[1fr,auto] gap-2">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category"
              className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={createCategory}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-3 text-primary-foreground"
              aria-label="Create category"
            >
              <Plus size={16} />
            </button>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">Showing {filteredWords.length} of {words.length} words</p>
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          {filteredWords.map((w) => (
            <VocabCard
              key={w.word}
              word={w.word}
              relevance={w.relevance}
              definition={w.definition}
              categories={(wordCategoryIds[w.word] ?? []).map((id) => categoriesById[id]).filter(Boolean)}
              selected={selected.has(w.word)}
              onSelect={() => toggle(w.word)}
              onManageCategories={() => setActiveWord(w.word)}
            />
          ))}

          {words.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="rounded-2xl glass p-8">
                <BookOpen size={36} className="mx-auto text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">All words marked as learned!</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {activeWord && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center p-5" onClick={() => setActiveWord(null)}>
            <div className="absolute inset-0 bg-black/65" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-3xl glass-modal-strong p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">Categories for {activeWord}</h3>
                <button type="button" onClick={() => setActiveWord(null)} className="rounded-full p-1 text-muted-foreground">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {allCategories.map((category) => {
                  const assigned = (wordCategoryIds[activeWord] ?? []).includes(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => toggleWordCategory(activeWord, category.id)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm ${
                        assigned ? "border-primary bg-primary/15 text-foreground" : "border-border/70 bg-background/50 text-muted-foreground"
                      }`}
                    >
                      <p className="font-semibold">{category.name}</p>
                      <p className="text-[11px] uppercase tracking-wide">topics</p>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="fixed bottom-[72px] left-0 right-0 z-40 flex justify-center gap-3 px-5 pb-3"
          >
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleMarkLearned} className="flex items-center gap-2 rounded-full glass btn-secondary-glass px-6 py-3 text-[14px] font-semibold text-foreground">
              <CheckCircle2 size={16} />
              Mark as Learned
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setLearningMode("chooser")} className="flex items-center gap-2 rounded-full bg-primary btn-primary-glow px-6 py-3 text-[14px] font-semibold text-primary-foreground shadow-lg shadow-primary/25">
              <Sparkles size={16} />
              Learn Words
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {learningMode === "chooser" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center px-5" onClick={() => setLearningMode(null)}>
            <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="relative z-10 w-full max-w-sm rounded-2xl glass-modal-strong p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-center text-lg font-bold text-foreground">Choose Learning Method</h2>
              <p className="mt-1 text-center text-sm text-muted-foreground">{selected.size} word{selected.size > 1 ? "s" : ""} selected</p>
              <div className="mt-5 flex flex-col gap-3">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setLearningMode("text")} className="flex items-center gap-4 rounded-2xl glass p-5 text-left">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15"><FileText size={22} className="text-primary" /></div>
                  <div><p className="font-semibold text-foreground">Generate Text</p><p className="text-[13px] text-muted-foreground">Read words in natural context</p></div>
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setDialogueWords(selectedWords); setLearningMode("dialogue"); }} className="flex items-center gap-4 rounded-2xl glass p-5 text-left">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15"><MessageCircle size={22} className="text-primary" /></div>
                  <div><p className="font-semibold text-foreground">Learn in Dialogue</p><p className="text-[13px] text-muted-foreground">Practice words in conversation</p></div>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <LearningTextModal open={learningMode === "text"} selectedWords={selectedWords.map((item) => item.word)} onClose={() => { setLearningMode(null); setSelected(new Set()); }} />
    </>
  );
};

export default DictionaryScreen;
