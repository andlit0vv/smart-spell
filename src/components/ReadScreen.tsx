import { useState } from "react";
import { Upload, BookOpen } from "lucide-react";

const ReadScreen = () => {
  return (
    <div className="mx-auto max-w-lg px-5 pb-36 pt-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Read</h1>
      <p className="mt-1 text-sm text-muted-foreground">Upload books to practice vocabulary in context.</p>

      <button className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-transform active:scale-[0.97]">
        <Upload size={18} />
        Upload a Book
      </button>

      <div className="mt-10 flex flex-col items-center justify-center py-12 text-center">
        <BookOpen size={40} className="text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">No books uploaded yet</p>
      </div>
    </div>
  );
};

export default ReadScreen;
