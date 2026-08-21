import React from 'react';
import { useTranslation } from 'react-i18next';
import { Segmented, SegmentedButton } from 'konsta/react';
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
    <Segmented
      strong
      rounded
      role="group"
      aria-label={t('theme.label')}
      className="gap-0.5 p-0.5"
      colors={{
        strongHighlightBgMaterial:
          'bg-md-light-primary dark:bg-md-dark-primary',
        strongHighlightBgIos:
          'bg-md-light-primary dark:bg-md-dark-primary',
      }}
    >
      {OPTIONS.map((opt) => (
        <SegmentedButton
          key={opt.value}
          active={theme === opt.value}
          className="h-9! w-9! px-0! rounded-full! [&.k-segmented-strong-button-active>*]:text-md-light-on-primary dark:[&.k-segmented-strong-button-active>*]:text-md-dark-on-primary"
          onClick={() => setTheme(opt.value)}
          title={t(opt.labelKey)}
          aria-label={t(opt.labelKey)}
          aria-pressed={theme === opt.value}
        >
          {opt.icon}
        </SegmentedButton>
      ))}
    </Segmented>
  );
};
