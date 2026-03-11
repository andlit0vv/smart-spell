import { motion } from "framer-motion";

interface VocabCardProps {
  word: string;
  domain: string;
  relevance: number;
  definition: string;
  selected?: boolean;
  onSelect?: () => void;
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
  selected = false,
  onSelect,
}: VocabCardProps) => {
  const domainColors = domainColorMap[domain] || "bg-muted text-muted-foreground";

  return (
    <motion.button
      layout
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`w-full rounded-2xl px-5 py-4 text-left transition-all duration-200 hover:shadow-lg ${
        selected
          ? "bg-accent text-accent-foreground shadow-lg shadow-accent/25"
          : "glass"
      }`}
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
  );
};

export default VocabCard;
