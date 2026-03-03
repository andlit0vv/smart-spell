import { useState } from "react";
import { ArrowRight, Languages } from "lucide-react";

const TranslationScreen = () => {
  const [word, setWord] = useState("");

  return (
    <div className="mx-auto max-w-lg px-5 pb-36 pt-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Translation</h1>
      <p className="mt-1 text-sm text-muted-foreground">Enter a word to translate and add to your dictionary.</p>

      <div className="mt-5 flex gap-2.5">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Type a word…"
          className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
        <button className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-[15px] font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-transform active:scale-[0.97]">
          <span className="hidden sm:inline">Enter a Word</span>
          <ArrowRight size={18} />
        </button>
      </div>

      <div className="mt-10 flex flex-col items-center justify-center py-12 text-center">
        <Languages size={40} className="text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">Enter a word above to get started</p>
      </div>
    </div>
  );
};

export default TranslationScreen;
