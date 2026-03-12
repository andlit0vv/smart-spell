import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";

interface WordCategory {
  name: string;
  color: string;
}

interface VocabCardProps {
  word: string;
  domain: string;
  relevance: number;
  definition: string;
  categories: WordCategory[];
  availableCategories: WordCategory[];
  selected?: boolean;
  onSelect?: () => void;
  onCategoryToggle: (category: WordCategory) => void;
  onCategoryCreate: (name: string) => void;
  isCategoryDropdownOpen: boolean;
  onCategoryDropdownChange: (open: boolean) => void;
}

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const safeHex = normalized.length === 3
    ? normalized
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
    : normalized;

  const int = Number.parseInt(safeHex, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
};

const getCategoryTone = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  return {
    tagBackground: `rgba(${r}, ${g}, ${b}, 0.32)`,
    panelBackground: `rgba(${r}, ${g}, ${b}, 0.22)`,
    border: `rgba(${r}, ${g}, ${b}, 0.6)`,
    text: `rgb(${Math.min(255, r + 105)}, ${Math.min(255, g + 105)}, ${Math.min(255, b + 105)})`,
  };
};

const VocabCard = ({
  word,
  relevance,
  definition,
  categories,
  availableCategories,
  selected = false,
  onSelect,
  onCategoryToggle,
  onCategoryCreate,
  isCategoryDropdownOpen,
  onCategoryDropdownChange,
}: VocabCardProps) => {
  const [showCreate, setShowCreate] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);

  const assignedNames = new Set(categories.map((item) => item.name));

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    onCategoryCreate(newCategoryName);
    setNewCategoryName("");
    setShowCreate(false);
  };

  const renderDropdown = () => (
    <AnimatePresence>
      {isCategoryDropdownOpen && (
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
          transition={{ duration: 0.15 }}
          onClick={(event) => event.stopPropagation()}
          className="absolute left-0 top-[calc(100%+8px)] z-[80] w-[260px] rounded-2xl glass-modal-strong p-2 shadow-xl shadow-black/25"
        >
          <div
            className="scrollbar-none flex h-9 items-center gap-1 overflow-x-auto px-1"
            onWheel={(event) => {
              if (event.deltaY === 0) return;
              event.currentTarget.scrollLeft += event.deltaY;
            }}
          >
            {availableCategories.map((availableCategory) => {
              const assigned = assignedNames.has(availableCategory.name);
              const tone = getCategoryTone(availableCategory.color);

              return (
                <button
                  key={availableCategory.name}
                  type="button"
                  onClick={() => onCategoryToggle(availableCategory)}
                  className={`group flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                    assigned ? "ring-2 ring-white/30" : "opacity-80 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: tone.tagBackground,
                    color: tone.text,
                    border: `1px solid ${tone.border}`,
                  }}
                >
                  <span>{availableCategory.name}</span>
                  {assigned && <X size={11} className="hidden group-hover:block" />}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setShowCreate((prev) => !prev)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-500/50 btn-secondary-glass bg-zinc-700/70 text-zinc-200 transition-colors hover:bg-zinc-600/80"
            >
              <Plus size={14} />
            </button>
          </div>

          {showCreate && (
            <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-semibold text-zinc-200">Create category</p>
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="Category name"
                className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 outline-none transition-colors focus:border-primary"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="mt-2 rounded-lg bg-primary btn-primary-glow px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Add
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <motion.button
      layout
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`relative w-full rounded-2xl px-5 py-4 text-left transition-all duration-200 hover:shadow-lg ${
        selected
          ? "bg-card-selected border-2 border-card-selected-border shadow-lg shadow-card-selected-border/30"
          : "glass border-2 border-transparent"
      } ${isCategoryDropdownOpen ? "z-30" : "z-0"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-lg font-bold leading-tight text-foreground">{word}</p>

            {categories.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {categories.map((category) => (
                  <div key={category.name} className="relative">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowCreate(false);
                        setActiveAnchor(category.name);
                        onCategoryDropdownChange(!isCategoryDropdownOpen);
                      }}
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-90"
                      style={{
                        backgroundColor: getCategoryTone(category.color).tagBackground,
                        color: getCategoryTone(category.color).text,
                        border: `1px solid ${getCategoryTone(category.color).border}`,
                      }}
                    >
                      {category.name}
                    </button>
                    {isCategoryDropdownOpen && activeAnchor === category.name && renderDropdown()}
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Add category"
                  title="Add category"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowCreate(false);
                    setActiveAnchor("plus");
                    onCategoryDropdownChange(!isCategoryDropdownOpen);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-600/60 btn-secondary-glass text-zinc-200 transition-all hover:bg-zinc-500/80"
                >
                  <Plus size={12} />
                </button>
                {isCategoryDropdownOpen && activeAnchor === "plus" && renderDropdown()}
              </div>
            )}
          </div>

          <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{definition}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end pt-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Relevance
          </span>
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
