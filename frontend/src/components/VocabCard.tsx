import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";

interface WordCategory {
  name: string;
  color: string;
}


const getLightTint = (hexColor: string) => {
  const normalized = hexColor.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "#FFFFFF";

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  const tint = (value: number) => Math.round(value + (255 - value) * 0.65);

  return `rgb(${tint(red)}, ${tint(green)}, ${tint(blue)})`;
};

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
}

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
}: VocabCardProps) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const assignedNames = new Set(categories.map((item) => item.name));

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    onCategoryCreate(newCategoryName);
    setNewCategoryName("");
    setShowCreate(false);
  };

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

            {categories.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {categories.map((category) => (
                  <button
                    key={category.name}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowDropdown((prev) => !prev);
                    }}
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: category.color, color: getLightTint(category.color) }}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                aria-label="Add category"
                title="Add category"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowDropdown((prev) => !prev);
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-600/60 text-zinc-200 transition-all hover:bg-zinc-500/80"
              >
                <Plus size={12} />
              </button>
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

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            onClick={(event) => event.stopPropagation()}
            className="absolute right-5 top-11 z-30 w-[240px] rounded-2xl border border-white/10 bg-zinc-900/95 p-3 shadow-xl"
          >
            <div
              className="overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              style={{ touchAction: "none" }}
              onWheel={(event) => {
                if (event.deltaY === 0) return;
                event.currentTarget.scrollLeft += event.deltaY;
              }}
            >
              <div className="flex w-max items-center gap-2">
                {availableCategories.map((category) => {
                  const assigned = assignedNames.has(category.name);

                  return (
                    <button
                      key={category.name}
                      type="button"
                      onClick={() => onCategoryToggle(category)}
                      className={`group flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                        assigned ? "ring-2 ring-white/40" : "opacity-75 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: category.color, color: getLightTint(category.color) }}
                    >
                      <span>{category.name}</span>
                      {assigned && <X size={11} className="hidden group-hover:block" />}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setShowCreate((prev) => !prev)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors"
                  style={{ borderColor: "#7C2D12", backgroundColor: "#7C2D12", color: "#FDBA74" }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {showCreate && (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
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
                  className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Add
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

export default VocabCard;
