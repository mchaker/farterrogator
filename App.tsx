import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { App as KonstaApp, Page, Button, Chip, Preloader } from 'konsta/react';
import { AlertCircle, Wand2, Sparkles } from 'lucide-react';
import { Header } from './components/Header';
import { ImageUpload } from './components/ImageUpload';
import { ToleranceControl } from './components/ToleranceControl';
import { Results } from './components/Results';
import { generateTags, fileToBase64, fetchBatchTags } from './services/taggerService';
import { fetchArtistMatches } from './services/kaloscopeService';
import { AppState, InterrogationResult, TaggingSettings, BackendConfig, BatchResult, ArtistMatch } from './types';
import { useTheme } from './hooks/useTheme';

const DEFAULT_BACKEND_CONFIG: BackendConfig = {
  taggerModel: 'wd',
  taggerBaseUrl: 'https://localtagger.gpu.garden',
};

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [result, setResult] = useState<InterrogationResult | null>(null);
  const [batchResults, setBatchResults] = useState<Record<string, BatchResult> | null>(null);
  const [artistMatches, setArtistMatches] = useState<ArtistMatch[] | null>(null);
  const [isMatchingArtists, setIsMatchingArtists] = useState(false);

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const [settings, setSettings] = useState<TaggingSettings>(() => {
    try {
      const saved = localStorage.getItem('taggingSettings');
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return {
      thresholds: { general: 0.7, character: 0.7, copyright: 0.7, artist: 0.7, meta: 0.7, rating: 0.8 },
      topK: 50,
      maxTags: 0,
      triggerPhrase: '',
      randomize: false,
      removeUnderscores: false,
    };
  });

  useEffect(() => {
    localStorage.setItem('taggingSettings', JSON.stringify(settings));
  }, [settings]);

  const [backendConfig, setBackendConfig] = useState<BackendConfig>(() => {
    try {
      const saved = localStorage.getItem('backendConfig');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migrate old config shapes that had 'type' field
        if (parsed.taggerModel && parsed.taggerBaseUrl) return parsed;
      }
    } catch { /* ignore */ }
    return DEFAULT_BACKEND_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('backendConfig', JSON.stringify(backendConfig));
  }, [backendConfig]);

  const [error, setError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<{ tags: boolean; progress: number; status: string }>({
    tags: false,
    progress: 0,
    status: '',
  });
  const { theme, setTheme } = useTheme();

  const handleFilesSelect = (files: File[]) => {
    setSelectedFiles(files);
    setAppState(AppState.IDLE);
    setResult(null);
    setBatchResults(null);
    setArtistMatches(null);
    setError(null);
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setResult(null);
    setBatchResults(null);
    setArtistMatches(null);
    setAppState(AppState.IDLE);
    setError(null);
  };

  const handleInterrogate = async () => {
    if (selectedFiles.length === 0) return;

    if (!backendConfig.taggerBaseUrl?.trim()) {
      setError(t('errors.taggerRequired'));
      setAppState(AppState.ERROR);
      return;
    }

    setAppState(AppState.ANALYZING);
    setLoadingState({ tags: true, progress: 0, status: t('status.starting') });
    setError(null);
    setResult(null);
    setBatchResults(null);
    setArtistMatches(null);

    try {
      if (selectedFiles.length === 1) {
        const file = selectedFiles[0];

        // Artist similarity runs in parallel with tagging; failures are non-fatal
        setIsMatchingArtists(true);
        const artistPromise = fetchArtistMatches(file, backendConfig.taggerBaseUrl)
          .then(matches => setArtistMatches(matches))
          .catch(err => {
            console.warn('Kaloscope artist matching unavailable:', err);
            setArtistMatches(null);
          })
          .finally(() => setIsMatchingArtists(false));

        const base64 = await fileToBase64(file);
        const res = await generateTags(base64, file.type, backendConfig, settings, i18n.language, (status, progress) => {
          setLoadingState(prev => ({ ...prev, status, progress }));
        });
        setResult(res);
        setAppState(AppState.SUCCESS);
        await artistPromise;
      } else {
        setLoadingState(prev => ({ ...prev, status: t('results.analyzing'), progress: 50 }));
        const results = await fetchBatchTags(selectedFiles, backendConfig, settings);
        setBatchResults(results);
        setAppState(AppState.SUCCESS);
      }
    } catch (err) {
      console.error(err);
      setAppState(AppState.ERROR);
      setError(err instanceof Error ? err.message : t('errors.unknown'));
    } finally {
      setLoadingState({ tags: false, progress: 100, status: t('status.done') });
    }
  };

  return (
    <KonstaApp theme="material" className="h-full selection:bg-red-500/30">
      <Page className="flex flex-col">
        <Header theme={theme} setTheme={setTheme} backendConfig={backendConfig} />

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 gap-6 lg:gap-8 flex flex-col lg:flex-row lg:items-start">

          {/* Left Column: Input */}
          <div className="w-full lg:w-[400px] xl:w-[450px] flex flex-col gap-6 shrink-0">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-md-light-on-surface dark:text-md-dark-on-surface px-1">
                {t('upload.inputImage')}
              </h2>
              <ImageUpload
                onFilesSelect={handleFilesSelect}
                selectedFiles={selectedFiles}
                onClear={handleClear}
              />
            </div>

            <Button
              large
              rounded
              onClick={handleInterrogate}
              disabled={selectedFiles.length === 0 || appState === AppState.ANALYZING}
              className="h-14! text-base font-semibold gap-2 shadow-md disabled:opacity-40"
            >
              {appState === AppState.ANALYZING ? (
                <>
                  <Preloader className="w-5 h-5 text-current" />
                  {t('results.analyzing')}
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" aria-hidden="true" />
                  {t('upload.interrogate')}
                </>
              )}
            </Button>

            <ToleranceControl
              settings={settings}
              backendConfig={backendConfig}
              onSettingsChange={setSettings}
              onBackendChange={setBackendConfig}
              disabled={appState === AppState.ANALYZING}
            />
          </div>

          {/* Right Column: Output */}
          <div className="flex-1 flex flex-col min-h-[500px] lg:h-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-2 px-1">
              <h2 className="text-lg font-semibold text-md-light-on-surface dark:text-md-dark-on-surface">{t('results.title')}</h2>
              <Chip className="uppercase text-[10px] font-semibold tracking-wide">
                {backendConfig.taggerModel}
              </Chip>
            </div>

            <div className="flex-1 bg-md-light-surface-1 dark:bg-md-dark-surface-1 rounded-[28px] p-2 transition-colors duration-300 relative min-h-[500px]">
              {!result && !batchResults && appState !== AppState.ERROR && (
                <div className="absolute inset-0 m-3 rounded-3xl border-2 border-dashed border-md-light-outline-variant dark:border-md-dark-outline-variant flex flex-col items-center justify-center text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant">
                  <Sparkles className="w-12 h-12 mb-3 opacity-20" />
                  <p className="font-medium opacity-60">{t('results.ready')}</p>
                  <p className="text-sm opacity-40 mt-1">{t('results.readySub')}</p>
                </div>
              )}

              {appState === AppState.ERROR && (
                <div className="h-full flex flex-col items-center justify-center text-red-500 dark:text-red-400 p-8 text-center">
                  <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                  <h3 className="text-lg font-bold mb-2">{t('results.failed')}</h3>
                  <p className="text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant max-w-md">{error}</p>
                  <div className="mt-4 p-3 bg-md-light-surface-2 dark:bg-md-dark-surface-2 rounded-xl text-xs text-left">
                    <p className="font-semibold mb-1">{t('results.troubleshoot')}</p>
                    <ul className="list-disc list-inside opacity-70 space-y-1">
                      <li>{t('results.troubleshootTagger', { endpoint: backendConfig.taggerBaseUrl })}</li>
                    </ul>
                  </div>
                </div>
              )}

              {result && selectedFiles.length === 1 && (
                <div className="h-full p-4">
                  <Results
                    result={result}
                    settings={settings}
                    loadingState={loadingState}
                    selectedFile={selectedFiles[0]}
                    artistMatches={artistMatches}
                    isMatchingArtists={isMatchingArtists}
                  />
                </div>
              )}

              {batchResults && (
                <div className="h-full p-4 overflow-auto">
                  <h3 className="text-lg font-bold mb-4">{t('results.batchResults')}</h3>
                  <div className="space-y-4">
                    {Object.entries(batchResults).map(([filename, data]: [string, BatchResult]) => (
                      <div key={filename} className="p-4 bg-md-light-surface-2 dark:bg-md-dark-surface-2 rounded-2xl">
                        <h4 className="font-semibold mb-2 text-sm">{filename}</h4>
                        <div className="bg-md-light-surface dark:bg-md-dark-surface p-3 rounded-xl font-mono text-xs break-all">
                          {data.tag_string}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="sticky bottom-0 z-20 py-3 flex flex-col items-center gap-1.5 text-center text-xs text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant bg-md-light-surface-2/80 dark:bg-md-dark-surface-2/80 backdrop-blur-md">
          <a
            href="https://gpu.garden"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
            title="GPU Garden"
            aria-label="GPU Garden"
          >
            <img src="/gpu-garden-logo.webp" alt="" className="w-6 h-6" aria-hidden="true" />
            <span className="text-sm font-bold bg-clip-text text-transparent bg-linear-to-r from-red-600 to-green-600 dark:from-red-400 dark:to-green-400">
              gpu.garden
            </span>
          </a>
          <p className="opacity-60">{t('app.copyright', { year: new Date().getFullYear() > 2025 ? `2025-${new Date().getFullYear()}` : '2025' })}</p>
        </footer>
      </Page>
    </KonstaApp>
  );
};

export default App;
