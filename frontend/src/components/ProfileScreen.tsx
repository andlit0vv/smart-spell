import { useEffect, useState } from "react";
import { Save, Pencil } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ThemeToggle from "./ThemeToggle";
import { apiFetch } from "@/lib/api";

interface ProfileScreenProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
  englishLevel: string;
  onEditEnglishLevel: () => void;
}

const ProfileScreen = ({ theme, toggleTheme, englishLevel, onEditEnglishLevel }: ProfileScreenProps) => {
  const [bio, setBio] = useState("");
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await apiFetch("/api/profile");
        if (!response.ok) return;
        const payload = await response.json();
        setName(payload.profile?.name || payload.user?.first_name || "");
        setBio(payload.profile?.bio || "");
        setAvatarUrl(payload.profile?.avatarUrl || payload.user?.photo_url || "");
      } catch {
        // Keep profile screen usable even if backend is temporarily unreachable.
      }
    };

    void loadProfile();
  }, []);

  const handleSave = async () => {
    if (!name.trim() && !bio.trim()) {
      toast.error("Please enter name or description first");
      return;
    }

    setIsSaving(true);

    try {
      const response = await apiFetch("/api/profile", {
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
        <div className="flex flex-col items-center">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Telegram avatar"
                className="h-24 w-24 rounded-full object-cover ring-4 ring-primary/20"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted ring-4 ring-primary/20">
                <span className="text-3xl font-bold text-muted-foreground">{name ? name.charAt(0).toUpperCase() : "?"}</span>
              </div>
            )}
          </div>
          <h2 className="mt-3 text-lg font-bold text-foreground">{name || "Your Name"}</h2>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">My English level</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[15px] font-semibold text-foreground">{englishLevel || "Not selected"}</p>
            <button
              type="button"
              onClick={onEditEnglishLevel}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <Pencil size={14} />
              Edit
            </button>
          </div>
        </div>

        <div className="mt-5">
          <label className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="mt-1.5 w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="mt-5">
          <label className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">About Me</label>
          <p className="mt-1 text-[13px] text-muted-foreground">Describe your profession, interests, and goals to personalize content.</p>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            placeholder="e.g. I'm a software engineer interested in cloud infrastructure…"
            className="mt-2 w-full resize-none rounded-xl border border-border bg-muted/50 px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
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
