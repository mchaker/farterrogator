import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation, Trans } from 'react-i18next';
import { X, HelpCircle, Zap, Shield, Cpu, Globe } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
    >
      <div 
        className="bg-white dark:bg-stone-950 rounded-2xl shadow-2xl max-w-336 w-full max-h-[95vh] overflow-y-auto border border-stone-200 dark:border-stone-800 animate-in zoom-in-50 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white/80 dark:bg-stone-950/80 backdrop-blur-md p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between z-10">
          <h2 id="info-modal-title" className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-red-500" aria-hidden="true" />
            {t('info.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5 text-stone-500" aria-hidden="true" />
          </button>
        </div>

        <div className="p-8 space-y-10">
          <section>
            <p className="text-stone-600 dark:text-stone-300 leading-relaxed text-lg">
              <Trans 
                i18nKey="info.description" 
                components={{ 
                  strong: <span className="font-bold text-stone-900 dark:text-stone-100" /> 
                }} 
              />
            </p>
          </section>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                {t('info.features.models.title')}
              </h3>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                <Trans i18nKey="info.features.models.description" components={{ strong: <strong /> }} />
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-red-500" />
                {t('info.features.naiReady.title')}
              </h3>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                <Trans i18nKey="info.features.naiReady.description" components={{ strong: <strong /> }} />
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-500" />
                {t('info.features.privacy.title')}
              </h3>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                <Trans i18nKey="info.features.privacy.description" components={{ strong: <strong /> }} />
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Globe className="w-5 h-5 text-green-500" />
                {t('info.features.gpuGarden.title')}
              </h3>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                {t('info.features.gpuGarden.description')}
              </p>
            </div>
          </div>

          <section className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-6 border border-stone-200 dark:border-stone-700">
            <h3 className="font-semibold text-stone-900 dark:text-stone-100 mb-2">{t('info.howTo.title')}</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-stone-600 dark:text-stone-400">
              <li>{t('info.howTo.step1')}</li>
              <li>{t('info.howTo.step2')}</li>
              <li>{t('info.howTo.step3')}</li>
              <li><Trans i18nKey="info.howTo.step4" components={{ strong: <strong /> }} /></li>
              <li><Trans i18nKey="info.howTo.step5" components={{ strong: <strong /> }} /></li>
            </ol>
          </section>
        </div>
        
        <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 text-center">
          <p className="text-xs text-stone-500">
            {t('info.madeBy')} <a href="https://mooshieblob.com" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors">Mooshieblob</a>
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};
