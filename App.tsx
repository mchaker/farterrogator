import React, { useState } from 'react';
import { Loader2, AlertCircle, Wand2, Sparkles } from 'lucide-react';
import { Header } from './components/Header';
import { ImageUpload } from './components/ImageUpload';
import { ToleranceControl } from './components/ToleranceControl';
import { Results } from './components/Results';
import { generateTags, generateCaption, fileToBase64, fetchLocalTags, fetchOllamaDescription, fetchOllamaModels } from './services/geminiService';
import { AppState, InterrogationResult, TaggingSettings, BackendConfig } from './types';
import { useTheme } from './hooks/useTheme';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<InterrogationResult | null>(null);

  const [settings, setSettings] = useState<TaggingSettings>({
    thresholds: {
      general: 0.7,
      character: 0.7,
      copyright: 0.7,
      artist: 0.7,
      meta: 0.7,
      rating: 0.8
    },
    topK: 50,
    randomize: false,
    removeUnderscores: false
  });

  const [backendConfig, setBackendConfig] = useState<BackendConfig>({
    type: 'local_hybrid',
    geminiApiKey: '',
    ollamaEndpoint: 'https://ollama.gpu.garden',
    ollamaModel: 'qwen3-vl:30b',
    taggerEndpoint: 'https://localtagger.gpu.garden/interrogate',
    enableNaturalLanguage: true
  });

  const [error, setError] = useState<string | null>(null);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleImageSelect = (file: File) => {
    setSelectedFile(file);
    setAppState(AppState.IDLE);
    setResult(null);
    setError(null);
    setIsGeneratingCaption(false);
  };

  const handleClear = () => {
    setSelectedFile(null);
    setResult(null);
    setAppState(AppState.IDLE);
    setError(null);
    setIsGeneratingCaption(false);
  };

  const validateBackendConfig = (): boolean => {
    if (backendConfig.type === 'gemini') {
      if (!backendConfig.geminiApiKey || backendConfig.geminiApiKey.trim() === '') {
        setError("Gemini API Key is required. Please configure it in the settings panel.");
        setAppState(AppState.ERROR);
        return false;
      }
    } else if (backendConfig.type === 'local_hybrid') {
      if (!backendConfig.ollamaEndpoint || backendConfig.ollamaEndpoint.trim() === '') {
        setError("Ollama Endpoint is required for Pixai mode.");
        setAppState(AppState.ERROR);
        return false;
      }
      if (!backendConfig.taggerEndpoint || backendConfig.taggerEndpoint.trim() === '') {
        setError("Local Tagger Endpoint is required for Pixai mode.");
        setAppState(AppState.ERROR);
        return false;
      }
    }
    return true;
  };

  const [loadingState, setLoadingState] = useState<{ tags: boolean; description: boolean }>({ tags: false, description: false });

  const handleInterrogate = async () => {
    if (!selectedFile) return;

    // Strict validation before starting
    if (!validateBackendConfig()) return;

    setAppState(AppState.ANALYZING);
    setLoadingState({ 
      tags: true, 
      description: backendConfig.type === 'local_hybrid' ? backendConfig.enableNaturalLanguage : false 
    });
    setError(null);
    setResult({ tags: [], naturalDescription: undefined }); // Reset result

    try {
      const base64 = await fileToBase64(selectedFile);

      // Unified flow for both Gemini and Local Hybrid
      // The logic for consolidation and optional NL is handled inside generateTags
      const interrogationResult = await generateTags(base64, selectedFile.type, backendConfig);

      setResult(interrogationResult);
      setLoadingState({ tags: false, description: false });
      setAppState(AppState.SUCCESS);

    } catch (err: any) {
      console.error(err);
      const msg = err?.message || "Failed to interrogate image.";
      setError(msg);
      setAppState(AppState.ERROR);
      setLoadingState({ tags: false, description: false });
    }
  };

  // Deprecated/Modified: handleGenerateCaption is now part of the main flow for Local Hybrid, 
  // but kept for Gemini or manual re-trigger if needed.
  const handleGenerateCaption = async () => {
    if (!selectedFile || !result) return;
    if (!validateBackendConfig()) return;

    setIsGeneratingCaption(true);
    try {
      const base64 = await fileToBase64(selectedFile);
      // If we have tags, we can use them to refine the description (Parity)
      // But generateCaption currently doesn't accept tags. 
      // We can just call generateCaption which uses Ollama/Gemini directly on the image.
      // OR we can implement a smarter flow here if needed.
      // For now, let's stick to the standard generateCaption which does a fresh look.
      // Ideally, we should pass the tags to ensure parity if that's what the user wants.

      const caption = await generateCaption(base64, selectedFile.type, backendConfig, result.tags);
      setResult(prev => prev ? { ...prev, naturalDescription: caption } : null);
    } catch (err) {
      console.error(err);
      setError("Failed to generate caption. Please try again.");
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-slate-200 selection:bg-red-500/30 selection:text-red-800 dark:selection:text-red-200 transition-colors duration-300">
      <Header theme={theme} setTheme={setTheme} backendConfig={backendConfig} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 gap-8 flex flex-col lg:flex-row lg:items-start">

        {/* Left Column: Input */}
        <div className="w-full lg:w-[400px] xl:w-[450px] flex flex-col gap-8 shrink-0">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Input Image</h2>
            <ImageUpload
              onImageSelect={handleImageSelect}
              selectedImage={selectedFile}
              onClear={handleClear}
            />
          </div>

          <div className="space-y-4">
            <button
              onClick={handleInterrogate}
              disabled={!selectedFile || appState === AppState.ANALYZING}
              className={`
                 w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg
                 ${!selectedFile
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : appState === AppState.ANALYZING
                    ? 'bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-300 cursor-wait border border-red-200 dark:border-red-500/30'
                    : 'bg-red-600 hover:bg-red-500 text-white hover:shadow-red-500/25 border border-red-400/20'
                }
               `}
            >
              {appState === AppState.ANALYZING ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Interrogating...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  Start Interrogation
                </>
              )}
            </button>

            <ToleranceControl
              settings={settings}
              backendConfig={backendConfig}
              onSettingsChange={setSettings}
              onBackendChange={setBackendConfig}
              disabled={appState === AppState.ANALYZING}
            />
          </div>
        </div>

        {/* Right Column: Output */}
        <div className="flex-1 flex flex-col min-h-[500px] lg:h-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Analysis Result</h2>
            {backendConfig.type !== 'gemini' && (
              <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50">
                Pixai
              </span>
            )}
          </div>

          <div className="flex-1 bg-white dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800 p-1 transition-colors duration-300 relative min-h-[500px]">
            {!result && appState !== AppState.ERROR && (
              <div className="absolute inset-0 m-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                <Sparkles className="w-12 h-12 mb-3 opacity-20" />
                <p className="font-medium opacity-50">Ready to Interrogate</p>
                <p className="text-sm opacity-30 mt-1">Upload an image to see tags and description</p>
              </div>
            )}

            {appState === AppState.ERROR && (
              <div className="h-full flex flex-col items-center justify-center text-red-500 dark:text-red-400 p-8 text-center">
                <AlertCircle className="w-12 h-12 mb-4 opacity-50" />
                <h3 className="text-lg font-bold mb-2">Analysis Failed</h3>
                <p className="text-slate-600 dark:text-slate-500 max-w-md">{error}</p>
                {backendConfig.type === 'local_hybrid' && (
                  <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-800/50 rounded text-xs text-left">
                    <p className="font-semibold mb-1">Troubleshooting Local Mode:</p>
                    <ul className="list-disc list-inside opacity-70 space-y-1">
                      <li>Ensure Ollama is running at {backendConfig.ollamaEndpoint}</li>
                      <li>Ensure Local Tagger is running at {backendConfig.taggerEndpoint}</li>
                      <li>Check CORS headers on both local servers</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {result && (
              <div className="h-full p-4">
                <Results
                  result={result}
                  settings={settings}
                  onGenerateCaption={handleGenerateCaption}
                  isGeneratingCaption={isGeneratingCaption}
                  loadingState={loadingState}
                  selectedFile={selectedFile}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;