import React, { useState, useEffect } from 'react';
import { Settings2, Shuffle, SortAsc, ChevronDown, ChevronUp, Layers, User, Palette, Cpu, Type, Shield, Server, Globe, Key, RefreshCw } from 'lucide-react';
import { TaggingSettings, TagCategory, BackendConfig, BackendType } from '../types';
import { fetchOllamaModels } from '../services/geminiService';

interface ToleranceControlProps {
  settings: TaggingSettings;
  backendConfig: BackendConfig;
  onSettingsChange: (settings: TaggingSettings) => void;
  onBackendChange: (config: BackendConfig) => void;
  disabled?: boolean;
}

export const ToleranceControl: React.FC<ToleranceControlProps> = ({
  settings,
  backendConfig,
  onSettingsChange,
  onBackendChange,
  disabled
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'tags' | 'backend'>('tags');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isAdvanced, setIsAdvanced] = useState(false);

  const updateThreshold = (category: TagCategory, value: number) => {
    onSettingsChange({
      ...settings,
      thresholds: {
        ...settings.thresholds,
        [category]: value
      }
    });
  };

  const updateOverallThreshold = (value: number) => {
    onSettingsChange({
      ...settings,
      thresholds: {
        ...settings.thresholds,
        general: value,
        character: value,
        copyright: value,
        artist: value,
        meta: value,
        rating: 0.8 // Ensure rating stays fixed
      }
    });
  };

  const handleFetchModels = async () => {
    if (!backendConfig.ollamaEndpoint) return;

    setIsLoadingModels(true);
    try {
      const models = await fetchOllamaModels(backendConfig.ollamaEndpoint);
      setAvailableModels(models);
      
      // Smart selection logic
      if (models.length > 0 && !models.includes(backendConfig.ollamaModel)) {
        // 1. Try to find a model that contains the current config name (e.g. 'qwen3-vl' -> 'qwen3-vl:30b')
        const partialMatch = models.find(m => m.includes(backendConfig.ollamaModel) || backendConfig.ollamaModel.includes(m));
        
        if (partialMatch) {
           onBackendChange({ ...backendConfig, ollamaModel: partialMatch });
        } else {
           // 2. Fallback to first available
           onBackendChange({ ...backendConfig, ollamaModel: models[0] });
        }
      }
    } catch (e) {
      console.error("Failed to load models", e);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Fetch models when switching to backend tab or when endpoint changes (debounced ideally, but here on blur/effect)
  useEffect(() => {
    if (activeTab === 'backend' && backendConfig.type === 'local_hybrid') {
      handleFetchModels();
    }
  }, [activeTab, backendConfig.type, backendConfig.ollamaEndpoint]);

  const categories: { id: TagCategory; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'copyright', label: 'Copyright', icon: <Globe className="w-3 h-3" />, color: 'text-purple-600 dark:text-purple-400' },
    { id: 'character', label: 'Character', icon: <User className="w-3 h-3" />, color: 'text-green-600 dark:text-green-400' },
    { id: 'artist', label: 'Artist', icon: <Palette className="w-3 h-3" />, color: 'text-amber-600 dark:text-amber-400' },
    { id: 'general', label: 'General', icon: <Layers className="w-3 h-3" />, color: 'text-blue-600 dark:text-blue-400' },
    { id: 'meta', label: 'Meta', icon: <Cpu className="w-3 h-3" />, color: 'text-slate-600 dark:text-slate-400' },
    { id: 'rating', label: 'Rating', icon: <Shield className="w-3 h-3" />, color: 'text-rose-600 dark:text-rose-400' },
  ];

  return (
    <div className="bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors duration-300 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
          <Settings2 className="w-4 h-4 text-red-600 dark:text-red-400" />
          <span>Configuration</span>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {isExpanded && (
        <div className="p-4 animate-in slide-in-from-top-2 duration-200">

          {/* Tabs */}
          <div className="flex p-1 mb-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => setActiveTab('tags')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'tags'
                  ? 'bg-white dark:bg-slate-600 text-red-600 dark:text-red-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
            >
              Tagging Rules
            </button>
            <button
              onClick={() => setActiveTab('backend')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'backend'
                  ? 'bg-white dark:bg-slate-600 text-red-600 dark:text-red-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
            >
              AI Backend
            </button>
          </div>

          {activeTab === 'tags' ? (
            <div className="space-y-6">
              {/* Output Options */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Output Settings</label>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-700 dark:text-slate-300">Top K Tags</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="10" max="100" step="5"
                      value={settings.topK}
                      onChange={(e) => onSettingsChange({ ...settings, topK: parseInt(e.target.value) })}
                      disabled={disabled}
                      className="w-24 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-red-600 [&::-webkit-slider-thumb]:rounded-full"
                    />
                    <span className="w-8 text-right text-xs font-mono text-slate-600 dark:text-slate-400">{settings.topK}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {settings.randomize ? <Shuffle className="w-4 h-4 text-red-500" /> : <SortAsc className="w-4 h-4 text-slate-400" />}
                    <span className="text-sm text-slate-700 dark:text-slate-300">Randomize Order</span>
                  </div>
                  <button
                    onClick={() => onSettingsChange({ ...settings, randomize: !settings.randomize })}
                    disabled={disabled}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${settings.randomize ? 'bg-red-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.randomize ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Type className={`w-4 h-4 ${settings.removeUnderscores ? 'text-red-500' : 'text-slate-400'}`} />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Remove Underscores</span>
                  </div>
                  <button
                    onClick={() => onSettingsChange({ ...settings, removeUnderscores: !settings.removeUnderscores })}
                    disabled={disabled}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${settings.removeUnderscores ? 'bg-red-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.removeUnderscores ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>

                {backendConfig.type === 'local_hybrid' && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Type className={`w-4 h-4 ${backendConfig.enableNaturalLanguage ? 'text-red-500' : 'text-slate-400'}`} />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        Natural Language Output <span className="text-xs text-slate-500 dark:text-slate-400">(this will take longer)</span>
                      </span>
                    </div>
                    <button
                      onClick={() => onBackendChange({ ...backendConfig, enableNaturalLanguage: !backendConfig.enableNaturalLanguage })}
                      disabled={disabled}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${backendConfig.enableNaturalLanguage ? 'bg-red-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${backendConfig.enableNaturalLanguage ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>
                )}
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-700" />

              {/* Thresholds */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Confidence Thresholds
                  </label>
                  <button
                    onClick={() => setIsAdvanced(!isAdvanced)}
                    className="text-[10px] text-blue-500 hover:text-blue-600 font-medium"
                  >
                    {isAdvanced ? 'Simple Mode' : 'Advanced Thresholds'}
                  </button>
                </div>

                <div className="space-y-4">
                  {!isAdvanced ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                          <Layers className="w-3 h-3" />
                          Overall Confidence
                        </div>
                        <span className="font-mono text-slate-500 dark:text-slate-400">
                          {settings.thresholds.general.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="0.95"
                        step="0.05"
                        value={settings.thresholds.general}
                        onChange={(e) => updateOverallThreshold(parseFloat(e.target.value))}
                        disabled={disabled}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-red-600 [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  ) : (
                    categories
                      .map(cat => (
                        <div key={cat.id} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <div className={`flex items-center gap-1.5 font-medium ${cat.color}`}>
                              {cat.icon}
                              {cat.label}
                            </div>
                            <span className="font-mono text-slate-500 dark:text-slate-400">
                              {settings.thresholds[cat.id].toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="0.95"
                            step="0.05"
                            value={settings.thresholds[cat.id]}
                            onChange={(e) => updateThreshold(cat.id, parseFloat(e.target.value))}
                            disabled={disabled}
                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-red-600 [&::-webkit-slider-thumb]:rounded-full"
                          />
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Backend Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['gemini', 'local_hybrid'] as BackendType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => onBackendChange({ ...backendConfig, type })}
                      className={`p-2 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition-all ${backendConfig.type === type
                          ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-500 text-red-700 dark:text-red-300'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-red-200 dark:hover:border-red-500/50'
                        }`}
                    >
                      {type === 'gemini' && <Globe className="w-4 h-4" />}
                      {type === 'local_hybrid' && <Server className="w-4 h-4" />}
                      {type === 'local_hybrid' ? 'Pixai (Ollama + Tagger)' : 'Google Gemini'}
                    </button>
                  ))}
                </div>
              </div>

              {backendConfig.type === 'gemini' && (
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-1">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Gemini API Key</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={backendConfig.geminiApiKey}
                        onChange={(e) => onBackendChange({ ...backendConfig, geminiApiKey: e.target.value })}
                        className="w-full text-sm pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-red-500 outline-none transition-all font-mono"
                        placeholder="AIza..."
                      />
                      <Key className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                    <p className="text-[10px] text-slate-400">Key is stored in memory only.</p>
                  </div>
                </div>
              )}

              {backendConfig.type === 'local_hybrid' && (
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-1">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded text-[10px] text-blue-600 dark:text-blue-300 leading-tight">
                    Seamlessly combines local tagger results with Ollama's reasoning and captioning capabilities.
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Ollama Endpoint (LLM/Vision)</label>
                    <input
                      type="text"
                      value={backendConfig.ollamaEndpoint}
                      onChange={(e) => onBackendChange({ ...backendConfig, ollamaEndpoint: e.target.value })}
                      className="w-full text-sm px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      placeholder="http://localhost:11434"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-slate-500">Ollama Model</label>
                      <button
                        onClick={handleFetchModels}
                        disabled={isLoadingModels}
                        className="text-[10px] text-blue-500 hover:text-blue-600 flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                        Refresh
                      </button>
                    </div>

                    {availableModels.length > 0 ? (
                      <div className="relative">
                        <select
                          value={backendConfig.ollamaModel}
                          onChange={(e) => onBackendChange({ ...backendConfig, ollamaModel: e.target.value })}
                          className="w-full text-sm px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-red-500 outline-none transition-all appearance-none"
                        >
                          {availableModels.map(model => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={backendConfig.ollamaModel}
                        onChange={(e) => onBackendChange({ ...backendConfig, ollamaModel: e.target.value })}
                        className="w-full text-sm px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-red-500 outline-none transition-all"
                        placeholder="qwen:vl (Enter manually if fetch fails)"
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Local Tagger Endpoint (WD1.4)</label>
                    <input
                      type="text"
                      value={backendConfig.taggerEndpoint}
                      onChange={(e) => onBackendChange({ ...backendConfig, taggerEndpoint: e.target.value })}
                      className="w-full text-sm px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      placeholder="/interrogate/pixai"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};