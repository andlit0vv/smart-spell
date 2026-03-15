import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Plus, Trash2, X } from "lucide-react";

export interface WordAnalysisCard {
  word: string;
  definition: string;
  relevance: number;
  examples: string[];
  translationRu: string;
  isInDictionary: boolean;
  contextSentence?: string;
}

interface SelectionAnalysisCardProps {
  analysisCard: WordAnalysisCard | null;
  analysisLoading: boolean;
  analysisError: string;
  dictionaryLoading: boolean;
  onClose: () => void;
  onDictionaryAction: () => void;
}

const SelectionAnalysisCard = ({
  analysisCard,
  analysisLoading,
  analysisError,
  dictionaryLoading,
  onClose,
  onDictionaryAction,
}: SelectionAnalysisCardProps) => (
  <AnimatePresence>
    {(analysisLoading || analysisError || analysisCard) && (
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        className="absolute bottom-24 left-5 right-5 z-20 overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/85 p-4 text-slate-100 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">
              {analysisLoading ? "Analyzing..." : analysisCard?.word || "Selection details"}
            </p>
            {!analysisLoading && analysisCard?.translationRu && (
              <p className="mt-1 inline-flex rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-200">
                {analysisCard.translationRu}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close analysis"
          >
            <X size={15} />
          </button>
        </div>

        {analysisError && <p className="mt-2 text-xs text-red-300">{analysisError}</p>}

        {!analysisLoading && analysisCard && (
          <>
            <p className="mt-3 text-sm leading-relaxed text-slate-100/90">{analysisCard.definition}</p>
            {analysisCard.contextSentence ? (
              <p className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-xs italic leading-relaxed text-slate-200/90">
                “{analysisCard.contextSentence}”
              </p>
            ) : null}

            {analysisCard.examples.length > 0 && (
              <p className="mt-2 text-xs italic leading-relaxed text-slate-300/90">{analysisCard.examples[0]}</p>
            )}

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <CheckCircle2 size={13} className="text-emerald-300" />
                Relevance: {analysisCard.relevance}/10
              </div>
              <button
                onClick={onDictionaryAction}
                disabled={dictionaryLoading}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
                  analysisCard.isInDictionary
                    ? "bg-rose-500/90 hover:bg-rose-500"
                    : "bg-blue-500/90 hover:bg-blue-500"
                }`}
              >
                {analysisCard.isInDictionary ? <Trash2 size={13} /> : <Plus size={13} />}
                {dictionaryLoading ? "..." : analysisCard.isInDictionary ? "Delete" : "Add"}
              </button>
            </div>
          </>
        )}
      </motion.div>
    )}
  </AnimatePresence>
);

export default SelectionAnalysisCard;
