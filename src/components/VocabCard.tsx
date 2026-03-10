import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";

interface VocabCardProps {
  word: string;
  domain: string;
  relevance: number;
  definition: string;
  translation?: string;
  examples?: string[];
  onSkip?: () => void;
  onAdd?: () => void;
  onLearnDialogue?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const domainColorMap: Record<string, string> = {
  IT: "bg-domain-it text-domain-it-foreground",
  Medicine: "bg-domain-medicine text-domain-medicine-foreground",
  "General/IT": "bg-domain-general text-domain-general-foreground",
  General: "bg-domain-general text-domain-general-foreground",
};

const VocabCard = ({
  word,
  domain,
  relevance,
  definition,
  translation = "",
  examples = [],
  onSkip,
  onAdd,
  onLearnDialogue,
  expanded = false,
  onToggleExpand,
}: VocabCardProps) => {
  const domainColors = domainColorMap[domain] || "bg-muted text-muted-foreground";

  return (
    <motion.div
      layout
      className="w-full rounded-2xl glass overflow-hidden transition-shadow duration-200 hover:shadow-lg"
    >
      {/* Clickable header */}
      <motion.button
        onClick={onToggleExpand}
        className="w-full text-left px-5 py-4"
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <p className="text-lg font-bold leading-tight text-foreground">{word}</p>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${domainColors}`}
              >
                {domain}
              </span>
            </div>
            <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground line-clamp-2">
              {definition}
            </p>
          </div>
          <div className="flex flex-col items-end shrink-0 pt-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Relevance
            </span>
            <span className="text-base font-bold text-foreground">
              {relevance}
              <span className="text-muted-foreground font-normal text-xs">/10</span>
            </span>
          </div>
        </div>
      </motion.button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              {/* Examples */}
              {examples.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Examples
                  </p>
                  <div className="space-y-1.5">
                    {examples.map((ex, i) => (
                      <p key={i} className="text-[13px] leading-relaxed text-foreground/80 italic">
                        "{ex}"
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Learn in Dialogue button */}
              {onLearnDialogue && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={onLearnDialogue}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-primary px-5 py-3 text-[14px] font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all"
                >
                  <MessageCircle size={17} />
                  Learn in Dialogue
                </motion.button>
              )}

              {/* Translation */}
              {translation && (
                <div className="rounded-xl bg-muted/50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Translation
                  </p>
                  <p className="text-[14px] text-foreground font-medium">{translation}</p>
                </div>
              )}

              {/* Skip / Add buttons */}
              <div className="flex gap-3">
                {onSkip && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onSkip}
                    className="flex-1 rounded-xl glass py-2.5 text-[14px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Skip
                  </motion.button>
                )}
                {onAdd && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={onAdd}
                    className="flex-1 rounded-xl bg-primary py-2.5 text-[14px] font-semibold text-primary-foreground shadow-md shadow-primary/15 transition-all"
                  >
                    Add
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default VocabCard;
