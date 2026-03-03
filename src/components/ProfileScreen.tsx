import { useState } from "react";
import { Save, UserCircle } from "lucide-react";
import { toast } from "sonner";

const ProfileScreen = () => {
  const [bio, setBio] = useState("");

  const handleSave = () => {
    toast.success("Profile saved successfully!");
  };

  return (
    <div className="mx-auto max-w-lg px-5 pb-36 pt-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">Personalize your learning experience.</p>

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <UserCircle size={22} className="text-primary" />
          <h2 className="text-base font-semibold text-foreground">About Me</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Describe your profession, interests, background, and goals. This helps us tailor content to you.
        </p>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={6}
          placeholder="e.g. I'm a software engineer interested in cloud infrastructure. I want to improve my English vocabulary for technical writing and conference talks…"
          className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
        <button
          onClick={handleSave}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-transform active:scale-[0.97]"
        >
          <Save size={16} />
          Save
        </button>
      </div>
    </div>
  );
};

export default ProfileScreen;
