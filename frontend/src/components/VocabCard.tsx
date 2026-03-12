import { motion } from "framer-motion";
import { Tag } from "lucide-react";

interface WordCategory {
  id: string;
  name: string;
  group: "domain" | "topic" | "context";
  color?: string;
}

interface VocabCardProps {
  word: string;
  relevance: number;
  definition: string;
  categories: WordCategory[];
  selected?: boolean;
  onSelect?: () => void;
  onManageCategories: () => void;
}

const GROUP_STYLES: Record<WordCategory["group"], string> = {
  domain: "bg-violet-500/15 text-violet-800 border-violet-400/70 dark:text-violet-200",
  topic: "bg-sky-500/15 text-sky-800 border-sky-400/70 dark:text-sky-200",
  context: "bg-emerald-500/15 text-emerald-800 border-emerald-400/70 dark:text-emerald-200",
};

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

const VocabCard = ({
  word,
  relevance,
  definition,
  categories,
  selected = false,
  onSelect,
  onManageCategories,
}: VocabCardProps) => {
  return (
    <motion.button
      layout
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`relative w-full rounded-2xl px-5 py-4 text-left transition-all duration-200 hover:shadow-lg ${
        selected
          ? "bg-card-selected border-2 border-card-selected-border shadow-lg shadow-card-selected-border/30"
          : "glass border-2 border-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-lg font-bold leading-tight text-foreground">{word}</p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onManageCategories();
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
            >
              <Tag size={11} />
              Manage
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {categories.length > 0 ? (
              categories.map((category) => (
                <span
                  key={category.id}
                  className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${category.color ? "" : GROUP_STYLES[category.group]}`}
                  style={category.color ? {
                    borderColor: hexToRgba(category.color, 0.75),
                    backgroundColor: hexToRgba(category.color, 0.18),
                    color: category.color,
                  } : undefined}
                >
                  {category.name}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-muted-foreground">No categories assigned</span>
            )}
          </div>

          <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{definition}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end pt-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Relevance</span>
          <span className="text-base font-bold text-foreground">
            {relevance}
            <span className="text-xs font-normal text-muted-foreground">/10</span>
          </span>
        </div>
      </div>
    </motion.button>
  );
};

export default VocabCard;
