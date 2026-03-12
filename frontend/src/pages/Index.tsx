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
    <div className="min-h-screen bg-background pt-16 transition-colors duration-300">
      {showLevelModal ? <EnglishLevelModal onComplete={handleLevelSelect} /> : null}
      {activeTab === "translation" && <TranslationScreen theme={theme} toggleTheme={toggleTheme} />}
      {activeTab === "read" && <ReadScreen theme={theme} toggleTheme={toggleTheme} />}
      {activeTab === "dictionary" && <DictionaryScreen theme={theme} toggleTheme={toggleTheme} />}
      {activeTab === "profile" && <ProfileScreen theme={theme} toggleTheme={toggleTheme} />}
      <BottomNav active={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
