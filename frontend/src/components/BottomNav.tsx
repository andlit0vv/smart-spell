import { Languages, BookOpen, BookMarked, User } from "lucide-react";
import { motion } from "framer-motion";

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
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav safe-bottom">
      <div className="mx-auto flex max-w-lg items-center py-2">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-colors"
            >
              <div className="relative flex h-6 w-6 items-center justify-center">
                {isActive && (
                  <motion.div
                    layoutId="navIndicator"
                    className="absolute -top-2 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <tab.icon
                  size={22}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className={`transition-colors ${isActive ? "text-nav-active" : "text-nav-inactive"}`}
                />
              </div>
              <span
                className={`text-[11px] transition-colors ${
                  isActive ? "font-semibold text-nav-active" : "font-medium text-nav-inactive"
                }`}
              >
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
