import { useState } from "react";
import { Upload, BookOpen, X, FileUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";

interface ReadScreenProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const ReadScreen = ({ theme, toggleTheme }: ReadScreenProps) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="mx-auto max-w-lg px-5 pb-36 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Read</h1>
          <p className="mt-1 text-sm text-muted-foreground">Upload books to practice vocabulary in context.</p>
        </div>
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setShowUploadModal(true)}
        className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform"
      >
        <Upload size={18} />
        Upload a Book
      </motion.button>

      <div className="mt-10 flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-2xl glass p-8">
          <BookOpen size={40} className="text-muted-foreground/40 mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">No books uploaded yet</p>
        </div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center px-5"
            onClick={() => setShowUploadModal(false)}
          >
            <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative z-10 w-full max-w-md rounded-2xl glass-modal p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-foreground">Upload a Book</h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="rounded-full p-1.5 hover:bg-muted transition-colors"
                >
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-12 transition-colors ${
                  dragOver ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <FileUp size={36} className="text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-foreground">Drag & drop a file here</p>
                <p className="mt-1 text-xs text-muted-foreground">Supports .txt and .fb2 files</p>
              </div>

              <div className="mt-4 flex gap-3">
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border bg-muted/50 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
                  <Upload size={16} />
                  Choose File
                  <input type="file" accept=".txt,.fb2" className="hidden" />
                </label>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20"
                >
                  Upload
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReadScreen;
