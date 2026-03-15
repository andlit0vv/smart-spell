import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CheckCircle2, MessageCircle, BookOpen, FileText, Plus, X } from "lucide-react";
import VocabCard from "./VocabCard";
import LearningTextModal from "./LearningTextModal";
import DialogueTraining from "./DialogueTraining";
import ThemeToggle from "./ThemeToggle";
import { DICTIONARY_UPDATED_EVENT, apiFetch } from "@/lib/api";

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
  color: string;
}

interface DictionaryScreenProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

type LearningMode = null | "chooser" | "text" | "dialogue";

const initialWords: WordData[] = [];

const createCategoryId = (name: string, group: WordCategory["group"]) =>
  `${group}:${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

const groupFromDomain = (_domain: string): WordCategory["group"] => "topic";

const PRESET_CATEGORY_COLORS: Record<string, string> = {
  it: "#a855f7",
  general: "#f97316",
  medicine: "#22c55e",
};

const STORAGE_KEYS = {
  categories: "dictionary:custom-categories",
  assignments: "dictionary:word-category-assignments",
};

const createRandomColor = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`;

const hexToRgba = (hexColor: string, alpha: number) => {
  const normalized = hexColor.replace("#", "");
  const sanitized = normalized.length === 3
    ? normalized.split("").map((symbol) => `${symbol}${symbol}`).join("")
    : normalized;

  const parsed = Number.parseInt(sanitized, 16);
  const red = (parsed >> 16) & 255;
  const green = (parsed >> 8) & 255;
  const blue = parsed & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const resolveCategoryColor = (name: string, fallback?: string) =>
  PRESET_CATEGORY_COLORS[name.toLowerCase().trim()] ?? fallback ?? createRandomColor();

const DictionaryScreen = ({ theme, toggleTheme }: DictionaryScreenProps) => {
  const [words, setWords] = useState<WordData[]>(initialWords);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [learningMode, setLearningMode] = useState<LearningMode>(null);
  const [dialogueWords, setDialogueWords] = useState<WordData[]>([]);

  const [categoriesById, setCategoriesById] = useState<Record<string, WordCategory>>({});
  const [wordCategoryIds, setWordCategoryIds] = useState<Record<string, string[]>>({});
  const [activeWord, setActiveWord] = useState<string | null>(null);

  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState("");

  useEffect(() => {
    try {
      const storedCategories = sessionStorage.getItem(STORAGE_KEYS.categories);
      if (storedCategories) {
        const parsed = JSON.parse(storedCategories) as Record<string, WordCategory>;
        setCategoriesById(parsed);
      }

      const storedAssignments = sessionStorage.getItem(STORAGE_KEYS.assignments);
      if (storedAssignments) {
        const parsed = JSON.parse(storedAssignments) as Record<string, string[]>;
        setWordCategoryIds(parsed);
      }
    } catch (storageError) {
      console.error("[Dictionary] Failed to restore session state", storageError);
    }
  }, []);

  useEffect(() => {
    const loadDictionary = async () => {
      try {
        const response = await apiFetch("/api/dictionary");
        const payload = await response.json();
        if (response.ok && Array.isArray(payload.words)) {
          setWords(payload.words);
        }
      } catch (error) {
        console.error("[Dictionary] Failed to load words", error);
      }
    };

    const handleDictionaryUpdated = () => {
      void loadDictionary();
    };

    void loadDictionary();
    window.addEventListener(DICTIONARY_UPDATED_EVENT, handleDictionaryUpdated);

    return () => {
      window.removeEventListener(DICTIONARY_UPDATED_EVENT, handleDictionaryUpdated);
    };
  }, []);

  useEffect(() => {
    const baseCategories: Record<string, Omit<WordCategory, "color">> = {};
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

    setCategoriesById((prev) => {
      const merged: Record<string, WordCategory> = { ...prev };

      Object.values(baseCategories).forEach((category) => {
        const previous = prev[category.id];
        merged[category.id] = {
          ...category,
          color: resolveCategoryColor(category.name, previous?.color),
        };
      });

      return merged;
    });
    setWordCategoryIds((prev) => ({ ...assignments, ...prev }));
  }, [words]);

  useEffect(() => {
    const loadTopics = async () => {
      try {
        const response = await apiFetch("/api/topics");
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload.topics)) return;

        setCategoriesById((prev) => {
          const next = { ...prev };
          payload.topics.forEach((topic: { name?: string }) => {
            const name = String(topic.name || "").trim();
            if (!name) return;
            const id = createCategoryId(name, "topic");
            const previous = prev[id];
            next[id] = {
              id,
              name,
              group: "topic",
              color: resolveCategoryColor(name, previous?.color),
            };
          });
          return next;
        });
      } catch (error) {
        console.error("[Dictionary] Failed to load topics", error);
      }
    };

    void loadTopics();
  }, []);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categoriesById));
  }, [categoriesById]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS.assignments, JSON.stringify(wordCategoryIds));
  }, [wordCategoryIds]);

  const allCategories = useMemo(() => Object.values(categoriesById), [categoriesById]);

  const visibleCategories = allCategories.sort((a, b) => a.name.localeCompare(b.name));

  const filteredWords = useMemo(() => words.filter((word) => {
    if (categoryFilters.size === 0) return true;
    const ids = wordCategoryIds[word.word] ?? [];
    return ids.some((id) => categoryFilters.has(id));
  }), [words, categoryFilters, wordCategoryIds]);

  const selectedWords = words.filter((w) => selected.has(w.word));

  useEffect(() => {
    if (categoryFilters.size === 0) {
      setSelected((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    setSelected((prev) => {
      const next = new Set(prev);
      filteredWords.forEach((item) => next.add(item.word));
      return next;
    });
  }, [categoryFilters, filteredWords]);

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

  const handleMarkLearned = async () => {
    const wordsToMark = Array.from(selected);
    if (wordsToMark.length === 0) return;

    try {
      const response = await apiFetch("/api/dictionary/learned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: wordsToMark }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to mark words as learned");

      const deletedWords = Array.isArray(payload.deletedWords) ? payload.deletedWords : wordsToMark;
      const deletedSet = new Set(deletedWords.map((word: string) => word.toLowerCase()));
      setWords((prev) => prev.filter((w) => !deletedSet.has(w.word.toLowerCase())));
      setSelected(new Set());
      notifyDictionaryUpdated();
    } catch (error) {
      console.error("[Dictionary] Failed to mark words as learned", error);
    }
  };

  const handleDialogueFinish = async (markAsLearned: boolean, learnedWords: string[]) => {
    if (markAsLearned && learnedWords.length > 0) {
      try {
        const response = await apiFetch("/api/dictionary/learned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ words: learnedWords }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to mark words as learned");

        const deletedWords = Array.isArray(payload.deletedWords) ? payload.deletedWords : learnedWords;
        const learnedSet = new Set(deletedWords.map((word: string) => word.toLowerCase()));
        setWords((prev) => prev.filter((w) => !learnedSet.has(w.word.toLowerCase())));
        notifyDictionaryUpdated();
      } catch (error) {
        console.error("[Dictionary] Failed to persist learned words", error);
      }
    }

    setLearningMode(null);
    setDialogueWords([]);
    setSelected(new Set());
  };

  const toggleWordCategory = async (word: string, categoryId: string) => {
    const current = wordCategoryIds[word] ?? [];
    const nextTopics = current.includes(categoryId)
      ? current.filter((id) => id !== categoryId)
      : [...current, categoryId];

    const topicNames = nextTopics.map((id) => categoriesById[id]?.name).filter(Boolean);

    try {
      const response = await apiFetch("/api/dictionary/topics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word,
          topics: topicNames,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to update word topics");

      const savedTopicNames: string[] = Array.isArray(payload.topics) ? payload.topics : topicNames;
      const savedIds = savedTopicNames
        .map((name) => allCategories.find((category) => category.name.toLowerCase() === String(name).toLowerCase())?.id)
        .filter(Boolean) as string[];

      setWordCategoryIds((prev) => ({
        ...prev,
        [word]: savedIds.length > 0 ? savedIds : nextTopics,
      }));
      notifyDictionaryUpdated();
    } catch (error) {
      console.error("[Dictionary] Failed to toggle word category", error);
    }
  };

  const createCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    const id = createCategoryId(trimmed, "topic");

    try {
      const response = await apiFetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to create topic");

      setCategoriesById((prev) => {
        if (prev[id]) return prev;
        return {
          ...prev,
          [id]: { id, name: trimmed, group: "topic", color: resolveCategoryColor(trimmed) },
        };
      });
      setNewCategoryName("");
    } catch (error) {
      console.error("[Dictionary] Failed to create category", error);
    }
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
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleDeleteSelectedCategories} className="text-xs font-semibold text-destructive">
                  Delete
                </button>
                <button type="button" onClick={() => setCategoryFilters(new Set())} className="text-xs font-semibold text-primary">
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {visibleCategories.map((category) => {
              const active = categoryFilters.has(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategoryFilter(category.id)}
                  className="rounded-full border px-3 py-1 text-xs font-semibold transition"
                  style={{
                    borderColor: active ? hexToRgba(category.color, 0.8) : "rgba(148, 163, 184, 0.4)",
                    backgroundColor: active ? hexToRgba(category.color, 0.2) : "rgba(148, 163, 184, 0.08)",
                    color: active ? category.color : "rgb(100, 116, 139)",
                  }}
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

          <p className="mt-2 text-xs text-muted-foreground">Showing {filteredWords.length} words</p>
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          {selected.size > 0 && (
            <div className="mb-1 grid grid-cols-2 gap-3 rounded-2xl glass p-3">
              <motion.button whileTap={{ scale: 0.95 }} onClick={handleMarkLearned} className="flex items-center justify-center gap-2 rounded-xl btn-secondary-glass px-4 py-2.5 text-[14px] font-semibold text-foreground">
                <CheckCircle2 size={16} />
                Mark as Learned
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setLearningMode("chooser")} className="flex items-center justify-center gap-2 rounded-xl bg-primary btn-primary-glow px-4 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-lg shadow-primary/25">
                <Sparkles size={16} />
                Learn Words
              </motion.button>
            </div>
          )}

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
                        assigned ? "text-foreground" : "text-muted-foreground"
                      }`}
                      style={{
                        borderColor: assigned ? hexToRgba(category.color, 0.8) : "rgba(148, 163, 184, 0.4)",
                        backgroundColor: assigned ? hexToRgba(category.color, 0.2) : "rgba(148, 163, 184, 0.08)",
                      }}
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
