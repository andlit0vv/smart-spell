import { useEffect, useState } from "react";
import BottomNav, { type TabId } from "@/components/BottomNav";
import DictionaryScreen from "@/components/DictionaryScreen";
import TranslationScreen from "@/components/TranslationScreen";
import ReadScreen from "@/components/ReadScreen";
import ProfileScreen from "@/components/ProfileScreen";
import { useTheme } from "@/hooks/useTheme";
import EnglishLevelModal from "@/components/EnglishLevelModal";
import { apiFetch } from "@/lib/api";
import AppLogo from "@/components/AppLogo";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("dictionary");
  const [dictionaryResetSignal, setDictionaryResetSignal] = useState(0);
  const [showFirstLevelModal, setShowFirstLevelModal] = useState(false);
  const [showEditLevelModal, setShowEditLevelModal] = useState(false);
  const [englishLevel, setEnglishLevel] = useState("");
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await apiFetch("/api/profile");
        if (!response.ok) return;

        const payload = await response.json();
        const savedLevel = payload.profile?.englishLevel || "";
        setEnglishLevel(savedLevel);

        if (!savedLevel) {
          setShowFirstLevelModal(true);
        }
      } catch {
        // Keep app usable even if backend is temporarily unreachable.
      }
    };

    void loadProfile();
  }, []);

  const handleFirstLevelSelect = async (levelRange: string) => {
    const response = await apiFetch("/api/profile", {
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

    setEnglishLevel(levelRange);
    setShowFirstLevelModal(false);
  };

  const handleEditLevel = async (levelRange: string) => {
    const response = await apiFetch("/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        englishLevel: levelRange,
        forceUpdateEnglishLevel: true,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to update level");
    }

    setEnglishLevel(levelRange);
    setShowEditLevelModal(false);
  };


  const handleTabChange = (tab: TabId) => {
    if (tab === "dictionary" && activeTab === "dictionary") {
      setDictionaryResetSignal((prev) => prev + 1);
    }
    setActiveTab(tab);
  };

  return (
    <div className="app-gradient-bg min-h-app bg-background pt-[calc(env(safe-area-inset-top)+16px)] transition-colors duration-300">
      <AppLogo />

      {showFirstLevelModal ? (
        <EnglishLevelModal onComplete={handleFirstLevelSelect} confirmLabel="Start" />
      ) : null}
      {showEditLevelModal ? (
        <EnglishLevelModal
          onComplete={handleEditLevel}
          title="Update your English level"
          description="Change your current level when you feel your level has improved."
          confirmLabel="Save level"
          initialLevel={englishLevel}
        />
      ) : null}

      <div className={activeTab === "translation" ? "block" : "hidden"}>
        <TranslationScreen theme={theme} toggleTheme={toggleTheme} />
      </div>
      <div className={activeTab === "read" ? "block" : "hidden"}>
        <ReadScreen theme={theme} toggleTheme={toggleTheme} />
      </div>
      <div className={activeTab === "dictionary" ? "block" : "hidden"}>
        <DictionaryScreen theme={theme} toggleTheme={toggleTheme} resetSignal={dictionaryResetSignal} />
      </div>
      <div className={activeTab === "profile" ? "block" : "hidden"}>
        <ProfileScreen
          theme={theme}
          toggleTheme={toggleTheme}
          englishLevel={englishLevel}
          onEditEnglishLevel={() => setShowEditLevelModal(true)}
        />
      </div>
      <BottomNav active={activeTab} onTabChange={handleTabChange} />
    </div>
  );
};

export default Index;
