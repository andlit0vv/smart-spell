import { Check } from "lucide-react";
import { motion } from "framer-motion";

interface VocabCardProps {
  word: string;
  domain: string;
  relevance: number;
  selected: boolean;
  onToggle: () => void;
}

const domainColorMap: Record<string, string> = {
  IT: "bg-domain-it text-domain-it-foreground",
  Medicine: "bg-domain-medicine text-domain-medicine-foreground",
  "General/IT": "bg-domain-general text-domain-general-foreground",
};

const VocabCard = ({ word, domain, relevance, selected, onToggle }: VocabCardProps) => {
  const domainColors = domainColorMap[domain] || "bg-muted text-muted-foreground";

  return (
    <motion.button
      layout
      onClick={onToggle}
      whileTap={{ scale: 0.98 }}
      className={`relative w-full rounded-lg border px-4 py-3.5 text-left transition-colors ${
        selected
          ? "border-card-selected-border bg-card-selected"
          : "border-border bg-card hover:border-input"
      }`}
    >
      {/* Checkmark */}
      <motion.div
        initial={false}
        animate={{ scale: selected ? 1 : 0, opacity: selected ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary"
      >
        <Check size={12} className="text-primary-foreground" strokeWidth={3} />
      </motion.div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-[15px] font-semibold leading-tight text-foreground">{word}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${domainColors}`}>
              {domain}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[11px] font-medium text-muted-foreground">relevance</span>
          <span className="text-sm font-bold text-foreground">{relevance}/10</span>
        </div>
      </div>
    </motion.button>
  );
};

export default VocabCard;
