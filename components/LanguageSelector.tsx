import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, List, ListItem } from "konsta/react";
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

  const dividerIndex = languages.findIndex((l) => l.code === "divider");
  const pinned = languages.slice(0, dividerIndex);
  const rest = languages.slice(dividerIndex + 1);

  const renderLang = (lang: { code: string; label: string }) => {
    const isActive = currentLang === lang.code;
    return (
      <ListItem
        key={lang.code}
        link
        linkComponent="button"
        linkProps={{
          type: "button",
          onClick: () => changeLanguage(lang.code),
          role: "menuitem",
          "aria-current": isActive ? "true" : undefined,
        }}
        chevron={false}
        title={lang.label}
        after={
          isActive ? (
            <Check className="w-4 h-4" aria-hidden="true" />
          ) : undefined
        }
        contentClassName={`w-full ${
          isActive
            ? "bg-md-light-secondary-container dark:bg-md-dark-secondary-container"
            : "hover:bg-black/5 dark:hover:bg-white/10"
        }`}
        colors={
          isActive
            ? {
                primaryTextMaterial:
                  "text-md-light-on-secondary-container dark:text-md-dark-on-secondary-container",
                secondaryTextMaterial:
                  "text-md-light-on-secondary-container dark:text-md-dark-on-secondary-container",
              }
            : undefined
        }
      />
    );
  };

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
          className="absolute right-0 top-full mt-2 w-44 rounded-xl overflow-hidden z-50 shadow-lg shadow-black/10 dark:shadow-black/30 bg-md-light-surface-2 dark:bg-md-dark-surface-2 animate-in fade-in zoom-in-95 duration-100"
          role="menu"
          aria-orientation="vertical"
          aria-label={t("common.languageSelection")}
        >
          <List className="my-0!" dividers={false}>
            {pinned.map(renderLang)}
            {rest.map((lang, i) => (
              <React.Fragment key={lang.code}>
                {i === 0 && (
                  <li
                    className="h-px bg-stone-200 dark:bg-stone-700 my-1"
                    role="separator"
                  />
                )}
                {renderLang(lang)}
              </React.Fragment>
            ))}
          </List>
        </div>
      )}
    </div>
  );
};
