import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from 'konsta/react';
import { Sparkles } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSelector } from './LanguageSelector';
import { Theme } from '../hooks/useTheme';
import { BackendConfig } from '../types';

interface HeaderProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  backendConfig: BackendConfig;
}

export const Header: React.FC<HeaderProps> = ({ theme, setTheme, backendConfig }) => {
  const { t } = useTranslation();

  const modelDisplay = useMemo(() => {
    return backendConfig.taggerModel?.toUpperCase() ?? t('header.nothingYet');
  }, [backendConfig, t]);

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
            {t('app.title').substring(0, 4)}<span className="text-primary dark:text-md-dark-primary">{t('app.title').substring(4)}</span>
          </h1>
        </div>
      }
      right={
        <div className="flex items-center gap-1.5 pr-2">
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-md-light-surface-3 dark:bg-md-dark-surface-3">
            <Sparkles className="w-3 h-3 text-primary dark:text-md-dark-primary" aria-hidden="true" />
            <span className="text-xs text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant">
              {t('header.poweredBy', { model: modelDisplay })}
            </span>
          </div>
          <LanguageSelector />
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      }
    />
  );
};
