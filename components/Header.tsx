import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { Theme } from '../hooks/useTheme';
import { BackendConfig } from '../types';

interface HeaderProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  backendConfig: BackendConfig;
}

export const Header: React.FC<HeaderProps> = ({ theme, setTheme, backendConfig }) => {
  const modelDisplay = useMemo(() => {
    if (backendConfig.type === 'gemini') {
      return "Gemini 3.0 Pro";
    }
    if (backendConfig.type === 'local_hybrid') {
      const model = backendConfig.ollamaModel?.trim();
      return model && model.length > 0 ? model : "Nothing yet";
    }
    return "Nothing yet";
  }, [backendConfig]);

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-red-500/10 rounded-lg border border-red-500/20">
            <img 
              src="/favicon.png" 
              alt="Logo" 
              className="w-7 h-7 object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Fart<span className="text-red-600 dark:text-red-500">errogator</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">AI Image Interrogator</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <Sparkles className="w-3 h-3 text-red-500 dark:text-red-400" />
            <span className="text-xs text-slate-600 dark:text-slate-400">Powered by {modelDisplay}</span>
          </div>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </div>
    </header>
  );
};