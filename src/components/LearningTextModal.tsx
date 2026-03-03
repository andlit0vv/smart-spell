import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BookmarkPlus } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const learningText = [
  "In modern software infrastructure, asynchronous communication plays a critical role in ensuring scalable systems. Through containerization, developers can isolate services and simplify deployment across distributed environments.",
  "A well-defined protocol ensures that services interact reliably, while robust infrastructure guarantees stability under heavy loads. During deployment, teams must carefully manage dependencies and monitor system performance.",
  "Although terms like myocardial are more common in medical contexts, the precision required in medicine is not unlike the precision required in engineering distributed systems.",
];

const LearningTextModal = ({ open, onClose }: Props) => {
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
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Generated Learning Text
            </h1>

            <div className="mt-5 flex-1 space-y-4 overflow-y-auto pb-6">
              {learningText.map((para, i) => (
                <p key={i} className="text-[15px] leading-relaxed text-foreground/85">
                  {para}
                </p>
              ))}
            </div>

            <div className="flex gap-3 pb-8 pt-4">
              <button
                onClick={onClose}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground transition-colors active:bg-muted"
              >
                <ArrowLeft size={16} />
                Back to Dictionary
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-transform active:scale-[0.97]">
                <BookmarkPlus size={16} />
                Save as Practice Session
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LearningTextModal;
