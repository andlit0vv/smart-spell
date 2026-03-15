import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

type Level = (typeof LEVELS)[number];

interface EnglishLevelModalProps {
  onComplete: (levelRange: string) => Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
  initialLevel?: string;
}

const isAdjacent = (a: Level, b: Level) => Math.abs(LEVELS.indexOf(a) - LEVELS.indexOf(b)) === 1;

const parseInitialSelection = (initialLevel?: string): Level[] => {
  if (!initialLevel) return [];
  const parts = initialLevel
    .split("-")
    .map((item) => item.trim())
    .filter((item): item is Level => LEVELS.includes(item as Level));

  if (parts.length === 1) return [parts[0]];
  if (parts.length === 2 && isAdjacent(parts[0], parts[1])) return [parts[0], parts[1]];
  return [];
};

const EnglishLevelModal = ({
  onComplete,
  title = "Choose your English level",
  description = "Move the slider to your level. Optionally include the next level range.",
  confirmLabel = "Start",
  initialLevel,
}: EnglishLevelModalProps) => {
  const initialSelection = parseInitialSelection(initialLevel);
  const [levelIndex, setLevelIndex] = useState(() => {
    if (initialSelection.length === 0) return 2;
    return LEVELS.indexOf(initialSelection[0]);
  });
  const [includeNext, setIncludeNext] = useState(() => initialSelection.length === 2);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const selectedRange = useMemo(() => {
    const current = LEVELS[levelIndex];
    const hasNext = levelIndex < LEVELS.length - 1;

    if (!includeNext || !hasNext) return current;
    return `${current}-${LEVELS[levelIndex + 1]}`;
  }, [includeNext, levelIndex]);

  const handleContinue = async () => {
    if (!selectedRange || isSaving) return;

    setIsSaving(true);
    setSaveError("");
    try {
      await onComplete(selectedRange);
    } catch {
      setSaveError("Cannot save your level right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 px-5 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md rounded-2xl glass-modal-strong bg-background/90 p-5 dark:bg-background/95"
      >
        <h2 className="text-center text-xl font-bold text-foreground">{title}</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">{description}</p>

        <div className="mt-6 rounded-2xl border border-border/60 bg-background/60 px-4 py-5">
          <div className="mb-3 flex items-center justify-between text-sm font-semibold text-foreground">
            <span>{LEVELS[0]}</span>
            <span>{LEVELS[LEVELS.length - 1]}</span>
          </div>
          <Slider
            value={[levelIndex]}
            min={0}
            max={LEVELS.length - 1}
            step={1}
            onValueChange={([value]) => setLevelIndex(value)}
            className="english-level-slider"
            aria-label="English level"
          />

          <div className="mt-4 grid grid-cols-6 gap-2">
            {LEVELS.map((level, index) => (
              <button
                key={level}
                type="button"
                onClick={() => setLevelIndex(index)}
                className={`rounded-lg px-1 py-1.5 text-xs font-semibold transition-colors ${
                  index === levelIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          <label className="mt-4 flex items-center justify-between rounded-xl border border-border/50 bg-muted/40 px-3 py-2.5 text-sm">
            <span className="text-foreground">Include next level</span>
            <input
              type="checkbox"
              checked={includeNext}
              disabled={levelIndex >= LEVELS.length - 1}
              onChange={(event) => setIncludeNext(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">Selected: {selectedRange}</p>
        {saveError ? <p className="mt-2 text-center text-sm text-red-500">{saveError}</p> : null}

        <button
          type="button"
          disabled={!selectedRange || isSaving}
          onClick={handleContinue}
          className="mt-4 w-full rounded-xl bg-primary btn-primary-glow py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {isSaving ? "Saving..." : confirmLabel}
        </button>
      </motion.div>
    </div>
  );
};

export default EnglishLevelModal;
