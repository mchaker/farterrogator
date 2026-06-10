import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Theme } from '../hooks/useTheme';

interface ThemeToggleProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const OPTIONS: { value: Theme; icon: React.ReactNode; labelKey: string }[] = [
  { value: 'light', icon: <Sun className="w-4 h-4" aria-hidden="true" />, labelKey: 'theme.light' },
  { value: 'auto', icon: <Monitor className="w-4 h-4" aria-hidden="true" />, labelKey: 'theme.auto' },
  { value: 'dark', icon: <Moon className="w-4 h-4" aria-hidden="true" />, labelKey: 'theme.dark' },
];

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, setTheme }) => {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-0.5 p-1 rounded-full bg-md-light-surface-3 dark:bg-md-dark-surface-3"
      role="group"
      aria-label={t('theme.label')}
    >
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
            theme === opt.value
              ? 'bg-md-light-primary-container dark:bg-md-dark-primary-container text-md-light-on-primary-container dark:text-md-dark-on-primary-container shadow-sm'
              : 'text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant hover:text-md-light-on-surface dark:hover:text-md-dark-on-surface'
          }`}
          title={t(opt.labelKey)}
          aria-label={t(opt.labelKey)}
          aria-pressed={theme === opt.value}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
};
