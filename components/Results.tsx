import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { Copy, Check, Hash, FileText, Tag as TagIcon, Sparkles, Loader2, User, Palette, Layers, Cpu, Shield, Globe, Download } from 'lucide-react';
import { InterrogationResult, TaggingSettings, Tag, TagCategory, LoadingState } from '../types';
import { embedPngMetadata } from '../services/pngMetadata';

interface ResultsProps {
  result: InterrogationResult;
  settings: TaggingSettings;
  onGenerateCaption: () => void; // Kept for backward compatibility or manual re-trigger
  isGeneratingCaption: boolean;
  loadingState: LoadingState;
  selectedFile: File | null;
}

export const Results: React.FC<ResultsProps> = ({
  result,
  settings,
  onGenerateCaption,
  isGeneratingCaption,
  loadingState,
  selectedFile
}) => {
  const { t } = useTranslation();
  const [copiedTags, setCopiedTags] = useState(false);
  const [copiedNatural, setCopiedNatural] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const processedTags = useMemo(() => {
    // 1. Filter by Category Thresholds
    let tags = result.tags.filter(tag => {
      const threshold = settings.thresholds[tag.category] || 0.5;
      return tag.score >= threshold;
    });

    // 2. Sort by Score (Descending)
    tags.sort((a, b) => b.score - a.score);

    // 3. Apply Top K
    tags = tags.slice(0, settings.topK);

    // 4. Randomize
    if (settings.randomize) {
      for (let i = tags.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tags[i], tags[j]] = [tags[j], tags[i]];
      }
    }

    return tags;
  }, [result.tags, settings]);

  const formatTag = (name: string) => {
    return settings.removeUnderscores ? name.replace(/_/g, ' ') : name;
  };

  const tagString = useMemo(() => {
    return processedTags.map(t => formatTag(t.name)).join(', ');
  }, [processedTags, settings.removeUnderscores]);

  const handleCopyTags = () => {
    navigator.clipboard.writeText(tagString);
    setCopiedTags(true);
    showToast(t('results.tagsCopied'));
    setTimeout(() => setCopiedTags(false), 2000);
  };

  const handleCopyNatural = () => {
    if (result.naturalDescription) {
      navigator.clipboard.writeText(result.naturalDescription);
      setCopiedNatural(true);
      showToast(t('results.descriptionCopied'));
      setTimeout(() => setCopiedNatural(false), 2000);
    }
  };

  const handleDownloadNai = async (content: string, suffix: string) => {
    if (!selectedFile) return;
    setIsEmbedding(true);
    try {
      const blob = await embedPngMetadata(selectedFile, content);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile.name.replace(/\.[^/.]+$/, "") + suffix;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to embed metadata", error);
      alert(t('results.embedFailed'));
    } finally {
      setIsEmbedding(false);
    }
  };

  const getCategoryColor = (category: TagCategory) => {
    switch (category) {
      case 'copyright': return 'text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-500/20 dark:border-purple-500/30';
      case 'character': return 'text-green-700 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-500/20 dark:border-green-500/30';
      case 'artist': return 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/20 dark:border-amber-500/30';
      case 'meta': return 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-700/40 dark:border-slate-600/50';
      case 'rating': return 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-500/20 dark:border-rose-500/30';
      case 'general': default: return 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-500/20 dark:border-blue-500/30';
    }
  };

  const getCategoryIcon = (category: TagCategory) => {
    switch (category) {
      case 'copyright': return <Globe className="w-3 h-3" />;
      case 'character': return <User className="w-3 h-3" />;
      case 'artist': return <Palette className="w-3 h-3" />;
      case 'meta': return <Cpu className="w-3 h-3" />;
      case 'rating': return <Shield className="w-3 h-3" />;
      case 'general': default: return <Layers className="w-3 h-3" />;
    }
  };

  // Data Fusion: Highlight tags in description
  const HighlightedDescription = () => {
    if (!result.naturalDescription) return null;

    const text = result.naturalDescription;
    // Create a regex from high-confidence tags (top 20 for performance/relevance)
    // We use the processedTags which are already filtered by threshold
    const tagsToHighlight = processedTags.slice(0, 30).map(t => t.name.replace(/_/g, ' ')); // Handle spaces if description uses spaces

    if (tagsToHighlight.length === 0) return <>{text}</>;

    // Escape regex special characters
    const escapedTags = tagsToHighlight.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`\\b(${escapedTags.join('|')})\\b`, 'gi');

    const parts = text.split(regex);

    return (
      <p className="text-slate-800 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-light text-lg">
        {parts.map((part, i) => {
          const isMatch = tagsToHighlight.some(t => t.toLowerCase() === part.toLowerCase());
          if (isMatch) {
            return (
              <span key={i} className="font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 animate-pulse-slow">
                {part}
              </span>
            );
          }
          return part;
        })}
      </p>
    );
  };

  return (
    <div className="flex flex-col h-full gap-6 overflow-y-auto pr-2">

      {/* Section 1: Natural Language Description */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4" aria-hidden="true" />
            {t('results.naturalDescription')}
          </h3>
          <div className="flex gap-2">
            {result.naturalDescription && !loadingState.description && (
              <button
                onClick={() => result.naturalDescription && handleDownloadNai(result.naturalDescription, "_nai_natural.png")}
                disabled={loadingState.description || !result.naturalDescription || isEmbedding || !selectedFile}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 hover:text-white bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-600 dark:hover:bg-purple-500 rounded-md transition-all border border-purple-200 dark:border-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download with Natural Description embedded"
                aria-label="Download with Natural Description embedded"
              >
                {isEmbedding ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Download className="w-3.5 h-3.5" aria-hidden="true" />}
                {t('results.naiReady')}
              </button>
            )}
            {result.naturalDescription && !loadingState.description && (
              <button
                onClick={handleCopyNatural}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Copy Description"
                aria-label="Copy Description"
              >
                {copiedNatural ? <Check className="w-4 h-4 text-green-500" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>

        <div className="min-h-[120px] bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 p-6 transition-colors duration-300 relative">
          {isGeneratingCaption || loadingState.description ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 py-4" role="status" aria-live="polite">
              <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                <span className="text-sm font-medium animate-pulse">{t('status.generatingDescription')}</span>
              </div>
              <div className="w-full max-w-xs space-y-2 opacity-50" aria-hidden="true">
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full w-full animate-pulse"></div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full w-5/6 animate-pulse"></div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full w-4/5 animate-pulse"></div>
              </div>
            </div>
          ) : loadingState.tags ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 py-4" role="status" aria-live="polite">
              <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
                <span className="text-sm font-medium animate-pulse">{loadingState.status || t('status.analyzing')}</span>
              </div>
            </div>
          ) : result.naturalDescription ? (
            <HighlightedDescription />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 py-4">
              <p className="text-sm italic mb-2">{t('results.descriptionNotGenerated')}</p>
              {!loadingState.description && !loadingState.tags && (
                <button
                  onClick={onGenerateCaption}
                  disabled={isGeneratingCaption}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-xs font-medium border border-blue-200 dark:border-blue-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('results.generateDescription')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Technical Tags */}
      <div className="flex flex-col gap-2 flex-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Hash className="w-4 h-4" aria-hidden="true" />
            {t('results.technicalTags')}
            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-xs font-normal text-slate-500">
              {loadingState.tags ? '...' : processedTags.length}
            </span>
          </h3>
          <div className="flex gap-2">
            {/* Settings Badges */}
            <div className="flex gap-1">
              {settings.randomize && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 text-[10px] font-medium border border-red-200 dark:border-red-500/30">
                  {t('results.randomized')}
                </span>
              )}
              {settings.removeUnderscores && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 text-[10px] font-medium border border-red-200 dark:border-red-500/30">
                  {t('results.noUnderscores')}
                </span>
              )}
            </div>
            <button
              onClick={handleCopyTags}
              disabled={loadingState.tags || processedTags.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:text-white bg-red-50 dark:bg-red-500/10 hover:bg-red-600 dark:hover:bg-red-500 rounded-md transition-all border border-red-200 dark:border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={copiedTags ? t('results.copied') : t('results.copyAll')}
            >
              {copiedTags ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
              {copiedTags ? t('results.copied') : t('results.copyAll')}
            </button>
            <button
              onClick={() => handleDownloadNai(tagString, "_nai_tags.png")}
              disabled={loadingState.tags || processedTags.length === 0 || isEmbedding || !selectedFile}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:text-white bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-600 dark:hover:bg-blue-500 rounded-md transition-all border border-blue-200 dark:border-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download with Tags embedded"
              aria-label="Download with Tags embedded"
            >
              {isEmbedding ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Download className="w-3.5 h-3.5" aria-hidden="true" />}
              {t('results.naiReady')}
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-[200px] bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 p-4 transition-colors duration-300 relative">
          {loadingState.tags ? (
            <div className="flex flex-col items-center justify-center h-full space-y-6 py-8" role="status" aria-live="polite">
              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>{loadingState.status || 'Processing...'}</span>
                  <span>{Math.round(loadingState.progress)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500 ease-out rounded-full relative"
                    style={{ width: `${Math.max(5, loadingState.progress)}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite] skew-x-12"></div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 animate-pulse opacity-30 justify-center max-w-lg blur-[1px]" aria-hidden="true">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {processedTags.map((tag, idx) =>
                <button
                  key={tag.name}
                  onClick={() => {
                    navigator.clipboard.writeText(formatTag(tag.name));
                    showToast(`Copied: ${formatTag(tag.name)}`);
                  }}
                  className={`
                      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all hover:scale-105 active:scale-95 border
                      ${getCategoryColor(tag.category)}
                      ${tag.source === 'ollama' ? 'border-dashed' : ''}
                      ${tag.source === 'both' ? 'ring-1 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 ring-blue-400/50' : ''}
                    `}
                  title={`Score: ${(tag.score * 100).toFixed(0)}% | Source: ${tag.source || 'local'}`}
                  aria-label={`${formatTag(tag.name)}, Score: ${(tag.score * 100).toFixed(0)}%, Source: ${tag.source || 'local'}`}
                >
                  <span className="opacity-50" aria-hidden="true">{getCategoryIcon(tag.category)}</span>
                  <span className="font-mono font-medium">{formatTag(tag.name)}</span>
                  <span className="ml-1 text-[10px] font-bold opacity-60 group-hover:opacity-100 bg-black/10 dark:bg-black/20 px-1.5 py-0.5 rounded" aria-hidden="true">
                    {tag.score.toFixed(2)}
                  </span>
                  {tag.source === 'ollama' && <span className="text-[10px] opacity-60 ml-0.5" aria-hidden="true">(AI)</span>}
                </button>
              )}
              {processedTags.length === 0 && (
                <div className="w-full text-center py-12 text-slate-400 dark:text-slate-500">
                  <TagIcon className="w-12 h-12 mx-auto mb-3 opacity-20" aria-hidden="true" />
                  <p>No tags found.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Raw Text View for Tags (Bottom) */}
        {!loadingState.tags && processedTags.length > 0 && (
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors duration-300">
            <p className="text-xs text-slate-500 font-mono wrap-break-word line-clamp-2 opacity-70 hover:opacity-100 transition-opacity select-all">
              {tagString}
            </p>
          </div>
        )}
      </div>

      {toastMessage && createPortal(
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200" role="status" aria-live="polite">
          <div className="bg-slate-900/90 dark:bg-white/90 text-white dark:text-slate-900 px-4 py-2 rounded-full shadow-lg backdrop-blur-sm flex items-center gap-2 text-sm font-medium">
            <Check className="w-4 h-4 text-green-500 dark:text-green-600" aria-hidden="true" />
            {toastMessage}
          </div>
        </div>,
        document.body
      )}

    </div >
  );
};