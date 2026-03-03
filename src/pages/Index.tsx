import { useState } from "react";
import BottomNav, { type TabId } from "@/components/BottomNav";
import DictionaryScreen from "@/components/DictionaryScreen";
import PlaceholderScreen from "@/components/PlaceholderScreen";

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("dictionary");

  return (
    <div className="min-h-screen bg-background">
      {activeTab === "translation" && <PlaceholderScreen title="Translation" />}
      {activeTab === "read" && <PlaceholderScreen title="Read" />}
      {activeTab === "dictionary" && <DictionaryScreen />}
      {activeTab === "profile" && <PlaceholderScreen title="Profile" />}
      <BottomNav active={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
