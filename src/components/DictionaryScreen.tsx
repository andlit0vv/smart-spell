import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CheckCircle2, Layers, BookOpen } from "lucide-react";
import VocabCard from "./VocabCard";
import LearningTextModal from "./LearningTextModal";
import FlashcardMode from "./FlashcardMode";
import DialogueTraining from "./DialogueTraining";
import ThemeToggle from "./ThemeToggle";

interface WordData {
  word: string;
  domain: string;
  relevance: number;
  definition: string;
  translation: string;
  examples: string[];
}

const initialWords: WordData[] = [
  {
    word: "Negotiate",
    domain: "General",
    relevance: 7,
    definition: "To discuss something in order to reach an agreement.",
    translation: "Вести переговоры, договариваться",
    examples: [
      "We need to negotiate the terms of the contract.",
      "She managed to negotiate a better deal.",
    ],
  },
  {
    word: "Asynchronous",
    domain: "IT",
    relevance: 9,
    definition: "A communication method where operations occur independently, without waiting for others to finish.",
    translation: "Асинхронный",
    examples: [
      "Asynchronous programming allows tasks to run concurrently.",
      "The API uses asynchronous calls to improve performance.",
    ],
  },
  {
    word: "Containerization",
    domain: "IT",
    relevance: 8,
    definition: "Packaging software with its dependencies into isolated, portable containers for deployment.",
    translation: "Контейнеризация",
    examples: [
      "Docker popularized containerization in the software industry.",
    ],
  },
  {
    word: "Protocol",
    domain: "General/IT",
    relevance: 7,
    definition: "A formal set of rules governing data transmission between systems or networks.",
    translation: "Протокол",
    examples: [
      "HTTP is a widely used protocol for web communication.",
      "The team agreed on a protocol for incident response.",
    ],
  },
  {
    word: "Myocardial",
    domain: "Medicine",
    relevance: 6,
    definition: "Relating to the muscular tissue of the heart, the myocardium.",
    translation: "Миокардиальный",
    examples: [
      "Myocardial infarction is a medical emergency requiring immediate treatment.",
    ],
  },
  {
    word: "Deployment",
    domain: "IT",
    relevance: 8,
    definition: "The process of releasing software to a production environment for end users.",
    translation: "Развёртывание",
    examples: [
      "The deployment pipeline automates testing and release.",
      "We scheduled the deployment for midnight to minimize downtime.",
    ],
  },
];

type LearningMode = null | "chooser" | "text" | "flashcards";

interface DictionaryScreenProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const DictionaryScreen = ({ theme, toggleTheme }: DictionaryScreenProps) => {
  const [words, setWords] = useState<WordData[]>(initialWords);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [learningMode, setLearningMode] = useState<LearningMode>(null);
  const [expandedWord, setExpandedWord] = useState<string | null>(null);
  const [dialogueWord, setDialogueWord] = useState<WordData | null>(null);

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

  const handleSkip = (word: string) => {
    setWords((prev) => prev.filter((w) => w.word !== word));
    setExpandedWord(null);
  };

  const handleAdd = (word: string) => {
    setSelected((prev) => new Set(prev).add(word));
    setExpandedWord(null);
  };

  const selectedWords = words.filter((w) => selected.has(w.word));

  // Dialogue training mode
  if (dialogueWord) {
    return (
      <DialogueTraining
        word={dialogueWord.word}
        definition={dialogueWord.definition}
        onExit={() => setDialogueWord(null)}
      />
    );
  }

  // Flashcard mode
  if (learningMode === "flashcards") {
    return (
      <FlashcardMode
        words={selectedWords}
        onExit={() => {
          setLearningMode(null);
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
              Tap a word to expand · select to learn in batch.
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
              translation={w.translation}
              examples={w.examples}
              expanded={expandedWord === w.word}
              onToggleExpand={() =>
                setExpandedWord((prev) => (prev === w.word ? null : w.word))
              }
              onSkip={() => handleSkip(w.word)}
              onAdd={() => handleAdd(w.word)}
              onLearnDialogue={() => setDialogueWord(w)}
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
                  onClick={() => setLearningMode("flashcards")}
                  className="flex items-center gap-4 rounded-2xl glass p-5 text-left transition-all hover:shadow-md"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                    <Layers size={22} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Learn with Flashcards</p>
                    <p className="text-[13px] text-muted-foreground">Flip cards to test your memory</p>
                  </div>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setLearningMode("text")}
                  className="flex items-center gap-4 rounded-2xl glass p-5 text-left transition-all hover:shadow-md"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                    <BookOpen size={22} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Learn with Text</p>
                    <p className="text-[13px] text-muted-foreground">Read words in natural context</p>
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
