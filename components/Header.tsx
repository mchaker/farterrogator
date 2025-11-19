import React, { useMemo, useState } from 'react';
import { Sparkles, HelpCircle } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { Theme } from '../hooks/useTheme';
import { BackendConfig } from '../types';
import { InfoModal } from './InfoModal';

interface HeaderProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  backendConfig: BackendConfig;
}

export const Header: React.FC<HeaderProps> = ({ theme, setTheme, backendConfig }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

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

        <button
          onClick={() => setIsModalOpen(true)}
          className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-sm font-medium"
        >
          <HelpCircle className="w-4 h-4" />
          What is this?
        </button>

        <div className="flex items-center gap-4">
          <a
            href="https://gpu.garden"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative p-px rounded-full bg-linear-to-r from-blue-500 via-purple-500 to-pink-500 bg-[length:200%_200%] animate-gradient-xy shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:shadow-[0_0_25px_rgba(168,85,247,0.7)] transition-all active:scale-95"
            title="GPU Garden"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors">
              <img src="https://gpu.garden/favicon.png" alt="GPU Garden" className="w-6 h-6" />
              <span className="text-sm font-bold bg-clip-text text-transparent bg-linear-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                gpu.garden
              </span>
            </div>
          </a>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <Sparkles className="w-3 h-3 text-red-500 dark:text-red-400" />
            <span className="text-xs text-slate-600 dark:text-slate-400">Powered by {modelDisplay}</span>
          </div>
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </div>
      <InfoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </header>
  );
};