import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import VocabCard from "./VocabCard";
import LearningTextModal from "./LearningTextModal";

const words = [
  { word: "Asynchronous", domain: "IT", relevance: 9 },
  { word: "Containerization", domain: "IT", relevance: 8 },
  { word: "Protocol", domain: "General/IT", relevance: 7 },
  { word: "Myocardial", domain: "Medicine", relevance: 6 },
  { word: "Deployment", domain: "IT", relevance: 8 },
  { word: "Infrastructure", domain: "IT", relevance: 7 },
];

const DictionaryScreen = () => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);

  const toggle = (word: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  };

  return (
    <>
      <div className="mx-auto max-w-lg px-5 pb-36 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My Dictionary</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select words to generate a learning text.
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          {words.map((w) => (
            <VocabCard
              key={w.word}
              word={w.word}
              domain={w.domain}
              relevance={w.relevance}
              selected={selected.has(w.word)}
              onToggle={() => toggle(w.word)}
            />
          ))}
        </div>
      </div>

      {/* Floating Learn Button */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="fixed bottom-[72px] left-0 right-0 z-40 flex justify-center px-5 pb-3"
          >
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[0.97]"
            >
              <Sparkles size={18} />
              Learn Words
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <LearningTextModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};

export default DictionaryScreen;
