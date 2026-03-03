import { useState } from "react";
import BottomNav, { type TabId } from "@/components/BottomNav";
import DictionaryScreen from "@/components/DictionaryScreen";
import TranslationScreen from "@/components/TranslationScreen";
import ReadScreen from "@/components/ReadScreen";
import ProfileScreen from "@/components/ProfileScreen";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("dictionary");

  return (
    <div className="min-h-screen bg-background">
      {activeTab === "translation" && <TranslationScreen />}
      {activeTab === "read" && <ReadScreen />}
      {activeTab === "dictionary" && <DictionaryScreen />}
      {activeTab === "profile" && <ProfileScreen />}
      <BottomNav active={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
