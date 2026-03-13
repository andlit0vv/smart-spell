import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

type Level = (typeof LEVELS)[number];

interface EnglishLevelModalProps {
  onComplete: (levelRange: string) => Promise<void>;
}

const isAdjacent = (a: Level, b: Level) => Math.abs(LEVELS.indexOf(a) - LEVELS.indexOf(b)) === 1;

const EnglishLevelModal = ({ onComplete }: EnglishLevelModalProps) => {
  const [selected, setSelected] = useState<Level[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const selectedRange = useMemo(() => {
    if (selected.length === 0) return "";
    if (selected.length === 1) return selected[0];

    const ordered = [...selected].sort((a, b) => LEVELS.indexOf(a) - LEVELS.indexOf(b));
    return `${ordered[0]}-${ordered[1]}`;
  }, [selected]);

  const toggleLevel = (level: Level) => {
    setSelected((prev) => {
      if (prev.includes(level)) {
        return prev.filter((item) => item !== level);
      }

      if (prev.length === 0) return [level];
      if (prev.length === 1) return isAdjacent(prev[0], level) ? [prev[0], level] : [level];
      return [level];
    });
  };

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
        className="w-full max-w-md rounded-2xl glass-modal-strong bg-background/90 dark:bg-background/95 p-5"
      >
        <h2 className="text-center text-xl font-bold text-foreground">Choose your English level</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Pick one level or two neighboring levels.
        </p>

        <Carousel opts={{ align: "center" }} className="mt-5">
          <CarouselContent>
            {LEVELS.map((level) => {
              const isActive = selected.includes(level);
              return (
                <CarouselItem key={level} className="basis-1/2 sm:basis-1/3">
                  <button
                    type="button"
                    onClick={() => toggleLevel(level)}
                    className={`h-24 w-full rounded-xl border text-lg font-bold transition-colors ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "btn-secondary-glass border-border bg-muted/60 text-foreground"
                    }`}
                  >
                    {level}
                  </button>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {selectedRange ? `Selected: ${selectedRange}` : "Swipe cards and tap to select"}
        </p>
        {saveError ? <p className="mt-2 text-center text-sm text-red-500">{saveError}</p> : null}

        <button
          type="button"
          disabled={!selectedRange || isSaving}
          onClick={handleContinue}
          className="mt-4 w-full rounded-xl bg-primary btn-primary-glow py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Start"}
        </button>
      </motion.div>
    </div>
  );
};

export default EnglishLevelModal;
