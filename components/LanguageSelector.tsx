import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "konsta/react";
import { Languages, Check } from "lucide-react";

export const LanguageSelector: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setIsOpen(false);
  };

  const languages = [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
    { code: "divider", label: "" },
    { code: "de", label: "Deutsch" },
    { code: "zh-TW", label: "繁體中文" }, // Fántǐ Zhōngwén
    { code: "fr", label: "Français" },
    { code: "ko", label: "한국어" }, // Hanguk-eo
    { code: "hi", label: "हिन्दी" }, // Hindi
    { code: "it", label: "Italiano" },
    { code: "zh-CN", label: "简体中文" }, // Jiǎntǐ Zhōngwén
    { code: "ja", label: "日本語" }, // Nihongo
    { code: "pt", label: "Português" },
    { code: "ru", label: "Русский" }, // Russkiy
  ];

  const currentLang = i18n.language || "en";
  const displayLang = currentLang.startsWith("zh")
    ? currentLang
    : currentLang.split("-")[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        clear
        rounded
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium uppercase ${
          isOpen
            ? "bg-md-light-primary/10 dark:bg-md-dark-primary/10 text-md-light-primary dark:text-md-dark-primary"
            : "text-stone-600 dark:text-stone-300"
        }`}
        title={t("common.changeLanguage")}
        aria-label={t("common.changeLanguage")}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Languages className="w-4 h-4" aria-hidden="true" />
        {displayLang}
      </Button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-36 bg-md-light-surface-2 dark:bg-md-dark-surface-2 rounded-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100"
          role="menu"
          aria-orientation="vertical"
          aria-label={t("common.languageSelection")}
        >
          {languages.map((lang) =>
            lang.code === "divider" ? (
              <div
                key="divider"
                className="h-px bg-stone-200 dark:bg-stone-700 my-1 mx-2"
                role="separator"
              />
            ) : (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${
                  currentLang === lang.code
                    ? "font-medium bg-md-light-primary/10 dark:bg-md-dark-primary/10 text-md-light-primary dark:text-md-dark-primary"
                    : "text-stone-600 dark:text-stone-400 hover:bg-md-light-surface-4 dark:hover:bg-md-dark-surface-4"
                }`}
                role="menuitem"
                aria-current={currentLang === lang.code ? "true" : undefined}
              >
                {lang.label}
                {currentLang === lang.code && (
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
};
