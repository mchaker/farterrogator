import React, { useState, useMemo } from 'react';
import { Copy, Check, Hash, FileText, Tag as TagIcon, Sparkles, Loader2, User, Palette, Layers, Cpu, Shield, Globe } from 'lucide-react';
import { InterrogationResult, TaggingSettings, Tag, TagCategory, LoadingState } from '../types';

interface ResultsProps {
  result: InterrogationResult;
  settings: TaggingSettings;
  onGenerateCaption: () => void; // Kept for backward compatibility or manual re-trigger
  isGeneratingCaption: boolean;
  loadingState: LoadingState;
}

export const Results: React.FC<ResultsProps> = ({
  result,
  settings,
  onGenerateCaption,
  isGeneratingCaption,
  loadingState
}) => {
  const [copiedTags, setCopiedTags] = useState(false);
  const [copiedNatural, setCopiedNatural] = useState(false);

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
    setTimeout(() => setCopiedTags(false), 2000);
  };

  const handleCopyNatural = () => {
    if (result.naturalDescription) {
      navigator.clipboard.writeText(result.naturalDescription);
      setCopiedNatural(true);
      setTimeout(() => setCopiedNatural(false), 2000);
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
              <span key={i} className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 animate-pulse-slow">
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
            <FileText className="w-4 h-4" />
            Natural Description
          </h3>
          {result.naturalDescription && !loadingState.description && (
            <button
              onClick={handleCopyNatural}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              title="Copy Description"
            >
              {copiedNatural ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          )}
        </div>

        <div className="min-h-[120px] bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 p-6 transition-colors duration-300 relative">
          {isGeneratingCaption || loadingState.description ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 py-4">
              <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm font-medium animate-pulse">Generating natural language description...</span>
              </div>
              <div className="w-full max-w-xs space-y-2 opacity-50">
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full w-full animate-pulse"></div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full w-5/6 animate-pulse"></div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full w-4/5 animate-pulse"></div>
              </div>
            </div>
          ) : result.naturalDescription ? (
            <HighlightedDescription />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 py-4">
              <p className="text-sm italic mb-2">Description not generated.</p>
              {!loadingState.description && !loadingState.tags && (
                <button
                  onClick={onGenerateCaption}
                  disabled={isGeneratingCaption}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-xs font-medium border border-blue-200 dark:border-blue-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Natural Language Description
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
            <Hash className="w-4 h-4" />
            Technical Tags
            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-xs font-normal text-slate-500">
              {loadingState.tags ? '...' : processedTags.length}
            </span>
          </h3>
          <div className="flex gap-2">
            {/* Settings Badges */}
            <div className="flex gap-1">
              {settings.randomize && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 text-[10px] font-medium border border-red-200 dark:border-red-500/30">
                  Randomized
                </span>
              )}
              {settings.removeUnderscores && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 text-[10px] font-medium border border-red-200 dark:border-red-500/30">
                  No Underscores
                </span>
              )}
            </div>
            <button
              onClick={handleCopyTags}
              disabled={loadingState.tags || processedTags.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 hover:text-white bg-red-50 dark:bg-red-500/10 hover:bg-red-600 dark:hover:bg-red-500 rounded-md transition-all border border-red-200 dark:border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copiedTags ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedTags ? 'Copied!' : 'Copy All'}
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-[200px] bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700 p-4 transition-colors duration-300 relative">
          {loadingState.tags ? (
            <div className="flex flex-wrap gap-2 animate-pulse">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
              ))}
              {[...Array(8)].map((_, i) => (
                <div key={i + 12} className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {processedTags.map((tag, idx) => (
                <div
                  key={`${tag.name}-${idx}`}
                  className={`
                      group flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-md border text-xs transition-all cursor-pointer hover:shadow-sm
                      ${getCategoryColor(tag.category)}
                    `}
                  title={`Category: ${tag.category} | Confidence: ${tag.score}`}
                  onClick={() => {
                    navigator.clipboard.writeText(formatTag(tag.name));
                  }}
                >
                  <span className="opacity-50">{getCategoryIcon(tag.category)}</span>
                  <span className="font-mono font-medium">{formatTag(tag.name)}</span>
                  <span className="ml-1 text-[10px] font-bold opacity-60 group-hover:opacity-100 bg-black/10 dark:bg-black/20 px-1.5 py-0.5 rounded">
                    {tag.score.toFixed(2)}
                  </span>
                </div>
              ))}
              {processedTags.length === 0 && (
                <div className="w-full text-center py-12 text-slate-400 dark:text-slate-500">
                  <TagIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No tags found.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Raw Text View for Tags (Bottom) */}
        {!loadingState.tags && processedTags.length > 0 && (
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors duration-300">
            <p className="text-xs text-slate-500 font-mono break-words line-clamp-2 opacity-70 hover:opacity-100 transition-opacity select-all">
              {tagString}
            </p>
          </div>
        )}
      </div>

    </div>
  );
};