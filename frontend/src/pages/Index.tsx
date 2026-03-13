import { useEffect, useState } from "react";
import BottomNav, { type TabId } from "@/components/BottomNav";
import DictionaryScreen from "@/components/DictionaryScreen";
import TranslationScreen from "@/components/TranslationScreen";
import ReadScreen from "@/components/ReadScreen";
import ProfileScreen from "@/components/ProfileScreen";
import { useTheme } from "@/hooks/useTheme";
import EnglishLevelModal from "@/components/EnglishLevelModal";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("dictionary");
  const [showLevelModal, setShowLevelModal] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/profile");
        if (!response.ok) return;

        const payload = await response.json();
        if (!payload.profile?.englishLevel) {
          setShowLevelModal(true);
        }
      } catch {
        // Keep app usable even if backend is temporarily unreachable.
      }
    };

    void loadProfile();
  }, []);

  const handleLevelSelect = async (levelRange: string) => {
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        englishLevel: levelRange,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to save level");
    }

    setShowLevelModal(false);
  };

  return (
    <div className="app-gradient-bg min-h-screen bg-background pt-12 transition-colors duration-300">
      {showLevelModal ? <EnglishLevelModal onComplete={handleLevelSelect} /> : null}
      <div className={activeTab === "translation" ? "block" : "hidden"}>
        <TranslationScreen theme={theme} toggleTheme={toggleTheme} />
      </div>
      <div className={activeTab === "read" ? "block" : "hidden"}>
        <ReadScreen theme={theme} toggleTheme={toggleTheme} />
      </div>
      <div className={activeTab === "dictionary" ? "block" : "hidden"}>
        <DictionaryScreen theme={theme} toggleTheme={toggleTheme} />
      </div>
      <div className={activeTab === "profile" ? "block" : "hidden"}>
        <ProfileScreen theme={theme} toggleTheme={toggleTheme} />
      </div>
      <BottomNav active={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
