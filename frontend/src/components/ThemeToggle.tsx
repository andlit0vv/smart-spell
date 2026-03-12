import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";

interface ThemeToggleProps {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const ThemeToggle = ({ theme, toggleTheme }: ThemeToggleProps) => (
  <motion.button
    whileTap={{ scale: 0.9 }}
    onClick={toggleTheme}
    className="flex h-10 w-10 items-center justify-center rounded-xl glass btn-secondary-glass transition-colors"
  >
    {theme === "light" ? (
      <Moon size={18} className="text-foreground" />
    ) : (
      <Sun size={18} className="text-primary" />
    )}
  </motion.button>
);

export default ThemeToggle;
