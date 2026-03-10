import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, CheckCircle, AlertCircle, ArrowRight, RotateCcw } from "lucide-react";

interface DialogueTrainingProps {
  word: string;
  definition: string;
  onExit: () => void;
}

interface FeedbackData {
  wordUsed: boolean;
  grammarOk: boolean;
  suggestion: string;
}

const scenarios = [
  {
    situation: "You are discussing your salary with your manager during a performance review.",
    question: "Why do you think you deserve a higher salary?",
  },
  {
    situation: "You are planning a team project deadline with your colleagues.",
    question: "How would you handle a disagreement about the timeline?",
  },
  {
    situation: "You are at a business meeting trying to close a deal with a new client.",
    question: "What approach would you take to reach a mutually beneficial agreement?",
  },
  {
    situation: "You are resolving a conflict between two team members who disagree on the approach.",
    question: "How would you help them find common ground?",
  },
];

const generateFeedback = (answer: string, word: string): FeedbackData => {
  const wordUsed = answer.toLowerCase().includes(word.toLowerCase());
  const grammarOk = answer.trim().length > 10 && answer.trim().endsWith(".");
  
  const suggestions: Record<string, string> = {
    negotiate: `A more natural version could be: "I would like to ${word} my salary based on my recent performance and results."`,
    asynchronous: `Try: "We should use ${word} communication to avoid blocking the team's progress."`,
    deployment: `Consider: "The ${word} process should include automated testing to ensure reliability."`,
  };

  return {
    wordUsed,
    grammarOk,
    suggestion: suggestions[word.toLowerCase()] || `Good effort! Try using "${word}" more naturally in your sentence.`,
  };
};

const DialogueTraining = ({ word, definition, onExit }: DialogueTrainingProps) => {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const scenario = scenarios[scenarioIndex % scenarios.length];

  const handleSubmit = () => {
    if (!answer.trim()) return;
    const fb = generateFeedback(answer, word);
    setFeedback(fb);
    setSubmitted(true);
  };

  const handleNext = () => {
    setScenarioIndex((i) => i + 1);
    setAnswer("");
    setFeedback(null);
    setSubmitted(false);
  };

  return (
    <div className="mx-auto max-w-lg px-5 pb-36 pt-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onExit}
          className="flex h-10 w-10 items-center justify-center rounded-xl glass"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </motion.button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Dialogue Practice</h1>
        </div>
      </div>

      {/* Target word badge */}
      <div className="flex items-center gap-2 mb-5">
        <span className="rounded-full bg-primary/15 px-4 py-1.5 text-[13px] font-bold text-primary">
          {word}
        </span>
        <span className="text-[12px] text-muted-foreground">{definition}</span>
      </div>

      {/* Situation card */}
      <motion.div
        key={scenarioIndex}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl glass p-5 mb-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-2">
          Situation
        </p>
        <p className="text-[14px] leading-relaxed text-foreground">{scenario.situation}</p>
      </motion.div>

      {/* AI Question */}
      <motion.div
        key={`q-${scenarioIndex}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="rounded-2xl glass p-5 mb-5"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <span className="text-xs font-bold text-primary">AI</span>
          </div>
          <p className="text-[14px] leading-relaxed text-foreground pt-1">{scenario.question}</p>
        </div>
      </motion.div>

      {/* Answer input */}
      {!submitted ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          <label className="text-[12px] font-medium text-muted-foreground">
            Write your answer using the word "<span className="text-primary font-semibold">{word}</span>"
          </label>
          <div className="relative">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={`Type your answer using "${word}"...`}
              rows={3}
              className="w-full rounded-2xl glass px-4 py-3 pr-12 text-[14px] text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleSubmit}
              disabled={!answer.trim()}
              className="absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40 shadow-md shadow-primary/20 transition-opacity"
            >
              <Send size={14} />
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="space-y-3"
            >
              {/* User answer recap */}
              <div className="rounded-2xl bg-muted/40 px-4 py-3">
                <p className="text-[12px] font-medium text-muted-foreground mb-1">Your answer</p>
                <p className="text-[13px] text-foreground italic">"{answer}"</p>
              </div>

              {/* Feedback card */}
              <div className="rounded-2xl glass p-5 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-1">
                  Feedback
                </p>

                <div className="flex items-center gap-2">
                  {feedback.wordUsed ? (
                    <CheckCircle size={15} className="text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle size={15} className="text-destructive shrink-0" />
                  )}
                  <p className="text-[13px] text-foreground">
                    {feedback.wordUsed
                      ? `Word "${word}" used correctly`
                      : `Try to include the word "${word}" in your answer`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {feedback.grammarOk ? (
                    <CheckCircle size={15} className="text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle size={15} className="text-secondary shrink-0" />
                  )}
                  <p className="text-[13px] text-foreground">
                    {feedback.grammarOk ? "Grammar looks good" : "Check grammar and punctuation"}
                  </p>
                </div>

                <div className="rounded-xl bg-muted/50 px-4 py-3 mt-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Suggested improvement
                  </p>
                  <p className="text-[13px] leading-relaxed text-foreground">{feedback.suggestion}</p>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex gap-3 pt-1">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleNext}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[14px] font-semibold text-primary-foreground shadow-lg shadow-primary/20"
                >
                  <ArrowRight size={16} />
                  Next Question
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setAnswer("");
                    setFeedback(null);
                    setSubmitted(false);
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl glass px-5 py-3 text-[14px] font-semibold text-foreground"
                >
                  <RotateCcw size={15} />
                  Retry
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default DialogueTraining;
