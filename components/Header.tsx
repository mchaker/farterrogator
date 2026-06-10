import React from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "konsta/react";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSelector } from "./LanguageSelector";
import { Theme } from "../hooks/useTheme";

interface HeaderProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const Header: React.FC<HeaderProps> = ({ theme, setTheme }) => {
  const { t } = useTranslation();

  return (
    <Navbar
      transparent
      className="top-0 sticky backdrop-blur-md"
      innerClassName="overflow-visible!"
      bgClassName="bg-md-light-surface-2/80 dark:bg-md-dark-surface-2/80"
      left={
        <div className="flex items-center gap-2.5 pl-2">
          <img
            src="/favicon.webp"
            alt="Logo"
            className="w-8 h-8 object-contain drop-shadow-sm"
          />
          <h1 className="text-lg font-bold leading-tight tracking-tight text-md-light-on-surface dark:text-md-dark-on-surface">
            {t("app.title").substring(0, 4)}
            <span className="text-primary dark:text-md-dark-primary">
              {t("app.title").substring(4)}
            </span>
          </h1>
        </div>
      }
      right={
        <div className="flex items-center gap-1.5 pr-2">
          <LanguageSelector />
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      }
    />
  );
};
