import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface WordData {
  word: string;
  domain: string;
  relevance: number;
  definition: string;
}

interface FlashcardModeProps {
  words: WordData[];
  onExit: () => void;
}

const FlashcardMode = ({ words, onExit }: FlashcardModeProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const current = words[currentIndex];

  const goNext = () => {
    if (currentIndex < words.length - 1) {
      setFlipped(false);
      setCurrentIndex((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setFlipped(false);
      setCurrentIndex((i) => i - 1);
    }
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col px-5 pb-36 pt-6 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Flashcards</h1>
          <p className="text-sm text-muted-foreground">
            {currentIndex + 1} of {words.length}
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onExit}
          className="flex items-center gap-1.5 rounded-full glass px-4 py-2 text-sm font-semibold text-foreground"
        >
          <X size={16} />
          Break Session
        </motion.button>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-muted mb-8">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Flashcard */}
      <div
        className="flex-1 flex items-center justify-center perspective-[1200px] cursor-pointer"
        onClick={() => setFlipped((f) => !f)}
      >
        <motion.div
          className="relative w-full max-w-sm"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* Front */}
          <div
            className="w-full rounded-2xl glass p-8 flex flex-col items-center justify-center min-h-[280px]"
            style={{ backfaceVisibility: "hidden" }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tap to flip</span>
            <h2 className="text-3xl font-bold text-foreground text-center">{current?.word}</h2>
            <span className="mt-3 inline-block rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              {current?.domain}
            </span>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 w-full rounded-2xl glass p-8 flex flex-col items-center justify-center min-h-[280px]"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Definition</span>
            <p className="text-[15px] leading-relaxed text-foreground text-center">{current?.definition}</p>
            <div className="mt-4 text-sm text-muted-foreground">
              Relevance: <span className="font-bold text-foreground">{current?.relevance}/10</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 pt-6">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="flex h-12 w-12 items-center justify-center rounded-full glass transition-opacity disabled:opacity-30"
        >
          <ChevronLeft size={22} className="text-foreground" />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={goNext}
          disabled={currentIndex === words.length - 1}
          className="flex h-12 w-12 items-center justify-center rounded-full glass transition-opacity disabled:opacity-30"
        >
          <ChevronRight size={22} className="text-foreground" />
        </motion.button>
      </div>
    </div>
  );
};

export default FlashcardMode;
