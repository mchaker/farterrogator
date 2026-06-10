import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar, Link } from 'konsta/react';
import { Sparkles, HelpCircle } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSelector } from './LanguageSelector';
import { Theme } from '../hooks/useTheme';
import { BackendConfig } from '../types';
import { InfoModal } from './InfoModal';

interface HeaderProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  backendConfig: BackendConfig;
}

export const Header: React.FC<HeaderProps> = ({ theme, setTheme, backendConfig }) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const modelDisplay = useMemo(() => {
    return backendConfig.taggerModel?.toUpperCase() ?? t('header.nothingYet');
  }, [backendConfig, t]);

  return (
    <>
      <Navbar
        transparent
        className="top-0 sticky backdrop-blur-md"
        bgClassName="bg-md-light-surface-2/80 dark:bg-md-dark-surface-2/80"
        left={
          <div className="flex items-center gap-3 pl-2">
            <div className="p-1.5 bg-red-500/10 rounded-xl">
              <img
                src="/favicon.webp"
                alt="Logo"
                className="w-7 h-7 object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight text-md-light-on-surface dark:text-md-dark-on-surface">
                {t('app.title').substring(0, 4)}<span className="text-primary dark:text-md-dark-primary">{t('app.title').substring(4)}</span>
              </h1>
              <p className="text-xs leading-tight text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant font-medium">
                {t('app.subtitle')}
              </p>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-2 pr-2">
            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-md-light-surface-3 dark:bg-md-dark-surface-3">
              <Sparkles className="w-3 h-3 text-primary dark:text-md-dark-primary" aria-hidden="true" />
              <span className="text-xs text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant">
                {t('header.poweredBy', { model: modelDisplay })}
              </span>
            </div>
            <Link
              iconOnly
              onClick={() => setIsModalOpen(true)}
              aria-label={t('header.whatIsThis')}
              title={t('header.whatIsThis')}
            >
              <HelpCircle className="w-5 h-5" aria-hidden="true" />
            </Link>
            <LanguageSelector />
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        }
      />
      <InfoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};
