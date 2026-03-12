import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Props {
  open: boolean;
  selectedWords: string[];
  onClose: () => void;
}

const normalizeStem = (word: string) => {
  let stem = word.toLowerCase().trim();
  const suffixes = [
    "ization",
    "isation",
    "ational",
    "ation",
    "ition",
    "ment",
    "ness",
    "ingly",
    "edly",
    "izing",
    "ising",
    "ized",
    "ised",
    "ing",
    "ed",
    "ize",
    "ise",
    "izer",
    "iser",
    "ly",
    "ity",
    "ty",
    "al",
    "ic",
    "er",
    "or",
    "s",
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of suffixes) {
      if (stem.length - suffix.length < 4) continue;
      if (stem.endsWith(suffix)) {
        stem = stem.slice(0, -suffix.length);
        changed = true;
        break;
      }
    }
  }

  return stem;
};

const ReadingText = ({ text, stems, words }: { text: string; stems: Set<string>; words: Set<string> }) => {
  const parts = text.split(/(\s+)/);

  return (
    <p className="text-[15px] leading-relaxed text-foreground/85">
      {parts.map((part, index) => {
        if (/^\s+$/.test(part)) return <span key={`${part}-${index}`}>{part}</span>;

        const clean = part.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "");
        const lower = clean.toLowerCase();
        const stem = normalizeStem(lower);
        const isTargetWord = words.has(lower) || (stem.length >= 4 && stems.has(stem));

        if (!isTargetWord) return <span key={`${part}-${index}`}>{part}</span>;

        return (
          <strong key={`${part}-${index}`} className="font-bold text-black dark:text-white">
            {part}
          </strong>
        );
      })}
    </p>
  );
};

const LearningTextModal = ({ open, selectedWords, onClose }: Props) => {
  const [allowWordForms, setAllowWordForms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [storyPrompt, setStoryPrompt] = useState("");

  const targetWordsSet = useMemo(
    () => new Set(selectedWords.map((word) => word.toLowerCase())),
    [selectedWords],
  );
  const targetStems = useMemo(
    () => new Set(selectedWords.map((word) => normalizeStem(word)).filter((stem) => stem.length >= 4)),
    [selectedWords],
  );

  const generateText = async () => {
    if (!selectedWords.length) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/reading/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_words: selectedWords,
          allow_word_forms: allowWordForms,
          story_prompt: storyPrompt.trim() || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to generate reading text");

      setText(payload.text || "");
    } catch (err) {
      console.error("[Reading] Failed to generate text", err);
      setError("Could not generate text. Please try again.");
      setText("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-background"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="mx-auto flex h-full max-w-lg flex-col px-5 pt-6"
          >
            <h1 className="text-xl font-bold tracking-tight text-foreground">Generated Learning Text</h1>

            <div className="mt-4 rounded-2xl glass p-4">
              <p className="text-sm font-semibold text-foreground">Generate Text</p>
              <label className="mt-3 block text-xs text-muted-foreground" htmlFor="story-prompt">
                Optional story idea
              </label>
              <input
                id="story-prompt"
                value={storyPrompt}
                onChange={(event) => setStoryPrompt(event.target.value)}
                placeholder="e.g., A travel story in the mountains"
                className="mt-1 w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
              />

              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/40 px-3 py-2">
                <div>
                  <p className="text-xs font-medium text-foreground/85">Allow different word forms</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Example: <span className="text-foreground/70">write</span> → <span className="text-foreground/70">writing</span>
                  </p>
                </div>
                <Switch checked={allowWordForms} onCheckedChange={setAllowWordForms} />
              </div>

              <button
                onClick={generateText}
                disabled={loading || selectedWords.length === 0}
                className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {loading ? (
                  "Generating..."
                ) : text ? (
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw size={14} />
                    Re-generate Text
                  </span>
                ) : (
                  "Generate Text"
                )}
              </button>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto pb-6">
              {error && <p className="text-sm text-red-500">{error}</p>}
              {!error && !text && !loading && (
                <p className="text-sm text-muted-foreground">Select options and generate a reading text.</p>
              )}
              {text && <ReadingText text={text} stems={targetStems} words={targetWordsSet} />}
            </div>

            <div className="pb-8 pt-4">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="flex w-full items-center justify-center gap-2 rounded-2xl glass py-3 text-sm font-semibold text-foreground transition-colors"
              >
                <ArrowLeft size={16} />
                Back to Dictionary
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LearningTextModal;
