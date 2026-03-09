import { useState } from "react";
import BottomNav, { type TabId } from "@/components/BottomNav";
import DictionaryScreen from "@/components/DictionaryScreen";
import TranslationScreen from "@/components/TranslationScreen";
import ReadScreen from "@/components/ReadScreen";
import ProfileScreen from "@/components/ProfileScreen";
import { useTheme } from "@/hooks/useTheme";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("dictionary");
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {activeTab === "translation" && <TranslationScreen theme={theme} toggleTheme={toggleTheme} />}
      {activeTab === "read" && <ReadScreen theme={theme} toggleTheme={toggleTheme} />}
      {activeTab === "dictionary" && <DictionaryScreen theme={theme} toggleTheme={toggleTheme} />}
      {activeTab === "profile" && <ProfileScreen theme={theme} toggleTheme={toggleTheme} />}
      <BottomNav active={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
