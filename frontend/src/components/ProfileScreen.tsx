import { useEffect, useState } from "react";
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
  // Added loading flag to prevent double-save clicks while backend request is running.
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load the last profile state from backend memory when Profile screen opens.
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/profile");
        if (!response.ok) return;
        const payload = await response.json();
        setName(payload.profile?.name || "");
        setBio(payload.profile?.bio || "");
      } catch {
        // Intentionally ignore initial-load errors to keep screen usable offline.
      }
    };

    loadProfile();
  }, []);

  const handleSave = async () => {
    // Previously this handler only showed toast; now it performs real backend save.
    // Validate empty profile so we do not send useless requests.
    if (!name.trim() && !bio.trim()) {
      toast.error("Please enter name or description first");
      return;
    }

    setIsSaving(true);

    try {
      // Send both name + bio to backend so they appear in IDE terminal and API response.
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim(),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Profile save failed");
      }

      toast.success(payload.message || "Profile saved successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cannot connect to backend");
    } finally {
      setIsSaving(false);
    }
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
            // Keep local state synced with user typing before sending on Save click.
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
            // Keep local state synced with user typing before sending on Save click.
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            placeholder="e.g. I'm a software engineer interested in cloud infrastructure…"
            className="mt-2 w-full resize-none rounded-xl bg-muted/50 border border-border px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={isSaving}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary btn-primary-glow py-3.5 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform disabled:opacity-70"
        >
          <Save size={16} />
          {isSaving ? "Saving..." : "Save"}
        </motion.button>
      </motion.div>
    </div>
  );
};

export default ProfileScreen;
