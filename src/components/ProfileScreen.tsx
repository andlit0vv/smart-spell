import { useState } from "react";
import { Save, Camera } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ThemeToggle from "./ThemeToggle";

interface ProfileScreenProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const ProfileScreen = ({ theme, toggleTheme }: ProfileScreenProps) => {
  const [bio, setBio] = useState("");
  const [name, setName] = useState("");

  const handleSave = () => {
    toast.success("Profile saved successfully!");
  };

  return (
    <div className="mx-auto max-w-lg px-5 pb-36 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">Personalize your learning experience.</p>
        </div>
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 rounded-2xl glass p-6"
      >
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center ring-4 ring-primary/20">
              <span className="text-3xl font-bold text-muted-foreground">
                {name ? name.charAt(0).toUpperCase() : "?"}
              </span>
            </div>
            <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Camera size={14} />
            </button>
          </div>
          <h2 className="mt-3 text-lg font-bold text-foreground">{name || "Your Name"}</h2>
        </div>

        {/* Name Input */}
        <div className="mt-5">
          <label className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="mt-1.5 w-full rounded-xl bg-muted/50 border border-border px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>

        {/* About Me */}
        <div className="mt-5">
          <label className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">About Me</label>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Describe your profession, interests, and goals to personalize content.
          </p>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            placeholder="e.g. I'm a software engineer interested in cloud infrastructure…"
            className="mt-2 w-full resize-none rounded-xl bg-muted/50 border border-border px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform"
        >
          <Save size={16} />
          Save
        </motion.button>
      </motion.div>
    </div>
  );
};

export default ProfileScreen;
