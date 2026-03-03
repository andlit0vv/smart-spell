import { Languages, BookOpen, BookMarked, User } from "lucide-react";

const tabs = [
  { id: "translation", label: "Translation", icon: Languages },
  { id: "read", label: "Read", icon: BookOpen },
  { id: "dictionary", label: "Dictionary", icon: BookMarked },
  { id: "profile", label: "Profile", icon: User },
] as const;

export type TabId = (typeof tabs)[number]["id"];

interface BottomNavProps {
  active: TabId;
  onTabChange: (tab: TabId) => void;
}

const BottomNav = ({ active, onTabChange }: BottomNavProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 transition-colors ${
                isActive ? "text-nav-active" : "text-nav-inactive"
              }`}
            >
              <tab.icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className={`text-[11px] ${isActive ? "font-semibold" : "font-medium"}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
