import React, { useState, useEffect, useCallback } from "react";
import { Trans, useTranslation } from "react-i18next";
import { App as KonstaApp, Page, Button, Preloader, Toast } from "konsta/react";
import { AlertCircle, Wand2, Sparkles } from "lucide-react";
import { Header } from "./components/Header";
import { ImageUpload } from "./components/ImageUpload";
import { ToleranceControl } from "./components/ToleranceControl";
import { Results } from "./components/Results";
import {
  generateTags,
  fetchBatchTags,
  fetchAvailableModels,
} from "./services/taggerService";
import { fetchArtistMatches } from "./services/kaloscopeService";
import { loadTagDatabase } from "./services/tagService";
import {
  AppState,
  InterrogationResult,
  TaggingSettings,
  BackendConfig,
  BatchResult,
  ArtistMatch,
  TaggerModelInfo,
  I18nError,
} from "./types";
import { useTheme } from "./hooks/useTheme";

const currentYear = new Date().getFullYear();
const copyrightYear = currentYear > 2025 ? `2025-${currentYear}` : "2025";

const DEFAULT_BACKEND_CONFIG: BackendConfig = {
  taggerModel: "wd-swinv2-v3",
  taggerBaseUrl: "https://localtagger.gpu.garden",
};

// Pre-multi-model configs stored alias ids that routed to fixed endpoints;
// map them onto the concrete model ids the backend now exposes.
const LEGACY_MODEL_IDS: Record<string, string> = {
  wd: "wd-eva02-large-v3",
  pixai: "wd-swinv2-v3",
  camie: "camie-v2",
  taggerine: "wd-swinv2-v3",
};

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [toastOpened, setToastOpened] = useState(true);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [result, setResult] = useState<InterrogationResult | null>(null);
  const [batchResults, setBatchResults] = useState<Record<
    string,
    BatchResult
  > | null>(null);
  const [artistMatches, setArtistMatches] = useState<ArtistMatch[] | null>(
    null,
  );
  const [isMatchingArtists, setIsMatchingArtists] = useState(false);

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // Warm the tag database so the first interrogation doesn't wait on it
  useEffect(() => {
    loadTagDatabase();
  }, []);

  const [settings, setSettings] = useState<TaggingSettings>(() => {
    try {
      const saved = localStorage.getItem("taggingSettings");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migrate old triggerPhrase field to whitelist
        if (parsed.whitelist === undefined)
          parsed.whitelist = parsed.triggerPhrase ?? "";
        if (parsed.blacklist === undefined) parsed.blacklist = "";
        delete parsed.triggerPhrase;
        return parsed;
      }
    } catch {
      /* ignore */
    }
    return {
      thresholds: {
        general: 0.7,
        character: 0.7,
        copyright: 0.7,
        artist: 0.7,
        meta: 0.7,
        rating: 0.8,
      },
      topK: 50,
      maxTags: 0,
      whitelist: "",
      blacklist: "",
      randomize: false,
      removeUnderscores: false,
    };
  });

  // Debounced: slider drags fire many changes per second
  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem("taggingSettings", JSON.stringify(settings));
    }, 300);
    return () => clearTimeout(id);
  }, [settings]);

  const [backendConfig, setBackendConfig] = useState<BackendConfig>(() => {
    try {
      const saved = localStorage.getItem("backendConfig");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migrate old config shapes that had 'type' field
        if (parsed.taggerModel && parsed.taggerBaseUrl) {
          parsed.taggerModel =
            LEGACY_MODEL_IDS[parsed.taggerModel] ?? parsed.taggerModel;
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_BACKEND_CONFIG;
  });

  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem("backendConfig", JSON.stringify(backendConfig));
    }, 300);
    return () => clearTimeout(id);
  }, [backendConfig]);

  // null = list unavailable (still loading or fetch failed); the picker then
  // degrades to showing just the currently selected id
  const [models, setModels] = useState<TaggerModelInfo[] | null>(null);

  const loadModels = useCallback(async (baseUrl: string) => {
    try {
      setModels(await fetchAvailableModels(baseUrl));
    } catch (err) {
      console.warn("Failed to load model list:", err);
    }
  }, []);

  // Debounced: the base URL input fires a change per keystroke
  useEffect(() => {
    const baseUrl = backendConfig.taggerBaseUrl?.trim();
    if (!baseUrl) return;
    const id = setTimeout(() => loadModels(baseUrl), 500);
    return () => clearTimeout(id);
  }, [backendConfig.taggerBaseUrl, loadModels]);

  // The enabled set is server-configured and may change; if the saved model
  // is no longer offered, fall back to a recommended one
  useEffect(() => {
    if (!models || models.length === 0) return;
    if (!models.some((m) => m.id === backendConfig.taggerModel)) {
      const fallback = models.find((m) => m.recommended) ?? models[0];
      setBackendConfig((prev) => ({ ...prev, taggerModel: fallback.id }));
    }
  }, [models]);

  const [error, setError] = useState<string | null>(null);
  const [lastTaggerModel, setLastTaggerModel] = useState<string>(
    backendConfig.taggerModel,
  );
  const [loadingState, setLoadingState] = useState<{
    tags: boolean;
    progress: number;
    status: string;
  }>({
    tags: false,
    progress: 0,
    status: "",
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
      setError(t("errors.taggerRequired"));
      setAppState(AppState.ERROR);
      return;
    }

    setAppState(AppState.ANALYZING);
    setLoadingState({ tags: true, progress: 0, status: t("status.starting") });
    setError(null);
    setResult(null);
    setBatchResults(null);
    setArtistMatches(null);

    try {
      if (selectedFiles.length === 1) {
        const file = selectedFiles[0];

        // Artist similarity runs in parallel with tagging; failures are non-fatal
        setIsMatchingArtists(true);
        const artistPromise = fetchArtistMatches(
          file,
          backendConfig.taggerBaseUrl,
        )
          .then((matches) => setArtistMatches(matches))
          .catch((err) => {
            console.warn("Kaloscope artist matching unavailable:", err);
            setArtistMatches(null);
          })
          .finally(() => setIsMatchingArtists(false));

        const res = await generateTags(
          file,
          backendConfig,
          settings,
          i18n.language,
          (status, progress) => {
            setLoadingState((prev) => ({ ...prev, status, progress }));
          },
        );
        setResult(res);
        setLastTaggerModel(backendConfig.taggerModel);
        setAppState(AppState.SUCCESS);
        await artistPromise;
      } else {
        setLoadingState((prev) => ({
          ...prev,
          status: t("results.analyzing"),
          progress: 50,
        }));
        const results = await fetchBatchTags(
          selectedFiles,
          backendConfig,
          settings,
        );
        setBatchResults(results);
        setLastTaggerModel(backendConfig.taggerModel);
        setAppState(AppState.SUCCESS);
      }
      // Refresh `loaded` flags now that this model's weights are warm
      loadModels(backendConfig.taggerBaseUrl);
    } catch (err) {
      console.error(err);
      setAppState(AppState.ERROR);
      setError(
        err instanceof I18nError
          ? t(err.key, err.params)
          : err instanceof Error
            ? err.message
            : t("errors.unknown"),
      );
      // 404 means the model is unknown/disabled server-side; re-sync the list
      if (err instanceof I18nError && err.params?.status === 404) {
        loadModels(backendConfig.taggerBaseUrl);
      }
    } finally {
      setLoadingState({ tags: false, progress: 100, status: t("status.done") });
    }
  };

  return (
    <KonstaApp theme="material" className="h-full selection:bg-red-500/30">
      <Toast
        position="center"
        opened={toastOpened}
        button={
          <Button
            rounded
            clear
            small
            inline
            onClick={() => setToastOpened(false)}
          >
            {t("common.close")}
          </Button>
        }
      >
        <div className="shrink">{t("app.modelsNotice")}</div>
      </Toast>
      <Page className="flex flex-col min-h-screen">
        <Header theme={theme} setTheme={setTheme} />

        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-8 gap-4 sm:gap-6 lg:gap-8 flex flex-col lg:flex-row lg:items-start pb-4">
          {/* Left Column: Input */}
          <div className="w-full lg:w-[380px] xl:w-[440px] flex flex-col gap-4 sm:gap-6 shrink-0">
            <div className="space-y-2">
              <h2 className="text-base sm:text-lg font-semibold text-md-light-on-surface dark:text-md-dark-on-surface px-1">
                {t("upload.inputImage")}
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
              disabled={
                selectedFiles.length === 0 || appState === AppState.ANALYZING
              }
              className="h-12! sm:h-14! text-base font-semibold gap-2 shadow-md disabled:opacity-40"
            >
              {appState === AppState.ANALYZING ? (
                <>
                  <Preloader className="w-5 h-5 text-current" />
                  {t("results.analyzing")}
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" aria-hidden="true" />
                  {t("upload.interrogate")}
                </>
              )}
            </Button>

            <ToleranceControl
              settings={settings}
              backendConfig={backendConfig}
              models={models}
              onSettingsChange={setSettings}
              onBackendChange={setBackendConfig}
              disabled={appState === AppState.ANALYZING}
            />
          </div>

          {/* Right Column: Output */}
          <div className="flex-1 flex flex-col min-h-[360px] sm:min-h-[480px] lg:h-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-2 px-1">
              <h2 className="text-base sm:text-lg font-semibold text-md-light-on-surface dark:text-md-dark-on-surface">
                {t("results.title")}
              </h2>
            </div>

            <div className="flex-1 bg-md-light-surface-1 dark:bg-md-dark-surface-1 rounded-3xl sm:rounded-[28px] p-2 transition-colors duration-300 relative min-h-[360px] sm:min-h-[480px]">
              {!result && !batchResults && appState !== AppState.ERROR && (
                <div className="absolute inset-0 m-3 rounded-3xl border-2 border-dashed border-md-light-outline-variant dark:border-md-dark-outline-variant flex flex-col items-center justify-center text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant">
                  <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 mb-3 opacity-20" />
                  <p className="font-medium opacity-60">{t("results.ready")}</p>
                  <p className="text-sm opacity-40 mt-1">
                    {t("results.readySub")}
                  </p>
                </div>
              )}

              {appState === AppState.ERROR && (
                <div className="h-full flex flex-col items-center justify-center text-red-500 dark:text-red-400 p-6 sm:p-8 text-center">
                  <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 mb-4 opacity-50" />
                  <h3 className="text-lg font-bold mb-2">
                    {t("results.failed")}
                  </h3>
                  <p className="text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant max-w-md text-sm sm:text-base">
                    {error}
                  </p>
                  <div className="mt-4 p-3 bg-md-light-surface-2 dark:bg-md-dark-surface-2 rounded-xl text-xs text-left w-full max-w-sm">
                    <p className="font-semibold mb-1">
                      {t("results.troubleshoot")}
                    </p>
                    <ul className="list-disc list-inside opacity-70 space-y-1">
                      <li className="break-all">
                        {t("results.troubleshootTagger", {
                          endpoint: backendConfig.taggerBaseUrl,
                        })}
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {result && selectedFiles.length === 1 && (
                <div className="h-full p-2 sm:p-4">
                  <Results
                    result={result}
                    settings={settings}
                    taggerModel={
                      models?.find((m) => m.id === lastTaggerModel)?.label ??
                      lastTaggerModel
                    }
                    loadingState={loadingState}
                    selectedFile={selectedFiles[0]}
                    artistMatches={artistMatches}
                    isMatchingArtists={isMatchingArtists}
                  />
                </div>
              )}

              {batchResults && (
                <div className="h-full p-3 sm:p-4 overflow-auto">
                  <h3 className="text-lg font-bold mb-4">
                    {t("results.batchResults")}
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(batchResults).map(
                      ([filename, data]: [string, BatchResult]) => (
                        <div
                          key={filename}
                          className="p-3 sm:p-4 bg-md-light-surface-2 dark:bg-md-dark-surface-2 rounded-2xl"
                        >
                          <h4 className="font-semibold mb-2 text-sm break-all">
                            {filename}
                          </h4>
                          <div className="bg-md-light-surface dark:bg-md-dark-surface p-3 rounded-xl font-mono text-xs break-all">
                            {data.tag_string}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="px-3 pb-2.5 pt-1 flex flex-wrap items-center justify-between gap-3 text-xs text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant">
          <a
            href="https://gpu.garden"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-md-light-surface-2/70 dark:bg-md-dark-surface-2/70 backdrop-blur-md active:scale-95 transition-transform shrink-0"
            title="GPU Garden"
            aria-label="GPU Garden"
          >
            <img
              src="/gpu-garden-logo.webp"
              alt=""
              className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 group-hover:scale-110"
              aria-hidden="true"
            />
            <span className="relative font-bold text-xs overflow-hidden">
              <span
                className="block text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant transition-opacity duration-250 group-hover:opacity-0"
                aria-hidden="true"
              >
                gpu.garden
              </span>
              <span
                className="absolute inset-0 bg-clip-text text-transparent bg-linear-to-r from-red-600 to-red-400 dark:from-red-400 dark:to-red-300 -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out"
                aria-hidden="true"
              >
                gpu.garden
              </span>
            </span>
          </a>

          <p className="opacity-50 px-3 py-1 rounded-full bg-md-light-surface-2/70 dark:bg-md-dark-surface-2/70 backdrop-blur-md text-center shrink-0 order-3 sm:order-2 basis-full sm:basis-auto whitespace-normal break-words">
            {t("app.copyright", { year: copyrightYear })}
          </p>

          <span className="px-3 py-1 rounded-full bg-md-light-surface-2/70 dark:bg-md-dark-surface-2/70 backdrop-blur-md opacity-60 shrink-0 order-2 sm:order-3">
            <Trans
              i18nKey="app.madeBy"
              components={{
                mooshieblob: (
                  <a
                    href="https://mooshieblob.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-md-light-primary dark:hover:text-md-dark-primary hover:opacity-100 transition-colors"
                  />
                ),
                ashtaka: (
                  <a
                    href="https://github.com/AshtakaOOf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-md-light-primary dark:hover:text-md-dark-primary hover:opacity-100 transition-colors"
                  />
                ),
              }}
            />
          </span>
        </footer>
      </Page>
    </KonstaApp>
  );
};

export default App;
