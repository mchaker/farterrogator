import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { Button, Progressbar, Preloader } from 'konsta/react';
import { Copy, Check, Hash, Tag as TagIcon, User, Palette, Layers, Cpu, Shield, Globe, Download, ExternalLink } from 'lucide-react';
import { InterrogationResult, TaggingSettings, Tag, TagCategory, LoadingState, ArtistMatch } from '../types';
import { embedPngMetadata } from '../services/pngMetadata';
import { normalizeTagName, parseTagList } from '../services/taggerService';

interface ResultsProps {
  result: InterrogationResult;
  settings: TaggingSettings;
  loadingState: LoadingState;
  selectedFile: File | null;
  artistMatches?: ArtistMatch[] | null;
  isMatchingArtists?: boolean;
}

export const Results: React.FC<ResultsProps> = ({ result, settings, loadingState, selectedFile, artistMatches, isMatchingArtists }) => {
  const { t } = useTranslation();
  const [copiedTags, setCopiedTags] = useState(false);
  const [copiedA1111, setCopiedA1111] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const processedTags = useMemo(() => {
    const blacklist = parseTagList(settings.blacklist);
    const whitelistNames = (settings.whitelist ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const whitelistSet = new Set(whitelistNames.map(normalizeTagName));

    let tags = result.tags.filter(tag => {
      const norm = normalizeTagName(tag.name);
      if (blacklist.has(norm)) return false;
      if (whitelistSet.has(norm)) return false; // re-added below at full score
      const threshold = settings.thresholds[tag.category] ?? 0.5;
      return tag.score >= threshold;
    });

    tags.sort((a, b) => b.score - a.score);
    tags = tags.slice(0, settings.topK);

    if (settings.randomize) {
      for (let i = tags.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tags[i], tags[j]] = [tags[j], tags[i]];
      }
    }

    // Whitelist tags are always included, ahead of everything else
    const whitelistTags: Tag[] = whitelistNames.map(name => ({ name, score: 1, category: 'general' }));
    return [...whitelistTags, ...tags];
  }, [result.tags, settings]);

  const formatTag = (name: string) => settings.removeUnderscores ? name.replace(/_/g, ' ') : name;

  const tagString = useMemo(
    () => processedTags.map(t => formatTag(t.name)).join(', '),
    [processedTags, settings.removeUnderscores]
  );

  // A1111 / ComfyUI format: escape literal ( ) \ so they aren't parsed as weight syntax
  const a1111TagString = useMemo(
    () => processedTags.map(t => formatTag(t.name).replace(/[\\()]/g, '\\$&')).join(', '),
    [processedTags, settings.removeUnderscores]
  );

  const handleCopyTags = () => {
    navigator.clipboard.writeText(tagString);
    setCopiedTags(true);
    showToast(t('results.tagsCopied'));
    setTimeout(() => setCopiedTags(false), 2000);
  };

  const handleCopyA1111 = () => {
    navigator.clipboard.writeText(a1111TagString);
    setCopiedA1111(true);
    showToast(t('results.tagsCopied'));
    setTimeout(() => setCopiedA1111(false), 2000);
  };

  const handleDownloadNai = async (content: string, suffix: string) => {
    if (!selectedFile) return;
    setIsEmbedding(true);
    try {
      const blob = await embedPngMetadata(selectedFile, content);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile.name.replace(/\.[^/.]+$/, '') + suffix;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to embed metadata', error);
      alert(t('results.embedFailed'));
    } finally {
      setIsEmbedding(false);
    }
  };

  const getCategoryColor = (category: TagCategory) => {
    switch (category) {
      case 'copyright': return 'text-purple-700 bg-purple-100 dark:text-purple-200 dark:bg-purple-500/25';
      case 'character': return 'text-green-700 bg-green-100 dark:text-green-200 dark:bg-green-500/25';
      case 'artist':    return 'text-amber-700 bg-amber-100 dark:text-amber-200 dark:bg-amber-500/25';
      case 'meta':      return 'text-slate-600 bg-slate-200/70 dark:text-slate-300 dark:bg-slate-500/25';
      case 'rating':    return 'text-rose-700 bg-rose-100 dark:text-rose-200 dark:bg-rose-500/25';
      case 'general':
      default:          return 'text-blue-700 bg-blue-100 dark:text-blue-200 dark:bg-blue-500/25';
    }
  };

  const getCategoryIcon = (category: TagCategory) => {
    switch (category) {
      case 'copyright': return <Globe className="w-3 h-3" />;
      case 'character': return <User className="w-3 h-3" />;
      case 'artist':    return <Palette className="w-3 h-3" />;
      case 'meta':      return <Cpu className="w-3 h-3" />;
      case 'rating':    return <Shield className="w-3 h-3" />;
      case 'general':
      default:          return <Layers className="w-3 h-3" />;
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto pr-2">

      {/* Technical Tags */}
      <div className="flex flex-col gap-2 flex-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-md-light-on-surface dark:text-md-dark-on-surface uppercase tracking-wider flex items-center gap-2">
            <Hash className="w-4 h-4" aria-hidden="true" />
            {t('results.technicalTags')}
            <span className="bg-md-light-surface-3 dark:bg-md-dark-surface-3 px-2 py-0.5 rounded-full text-xs font-normal text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant">
              {loadingState.tags ? '...' : processedTags.length}
            </span>
          </h3>
          <div className="flex gap-2 items-center">
            <div className="flex gap-1">
              {settings.randomize && (
                <span className="px-2 py-0.5 rounded-full bg-md-light-secondary-container dark:bg-md-dark-secondary-container text-md-light-on-secondary-container dark:text-md-dark-on-secondary-container text-[10px] font-medium">
                  {t('results.randomized')}
                </span>
              )}
              {settings.removeUnderscores && (
                <span className="px-2 py-0.5 rounded-full bg-md-light-secondary-container dark:bg-md-dark-secondary-container text-md-light-on-secondary-container dark:text-md-dark-on-secondary-container text-[10px] font-medium">
                  {t('results.noUnderscores')}
                </span>
              )}
            </div>
            <Button
              small
              rounded
              tonal
              inline
              onClick={handleCopyTags}
              disabled={loadingState.tags || processedTags.length === 0}
              className="gap-1.5 text-xs disabled:opacity-50"
              aria-label={copiedTags ? t('results.copied') : t('results.copyAll')}
            >
              {copiedTags ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
              {copiedTags ? t('results.copied') : t('results.copyAll')}
            </Button>
            <Button
              small
              rounded
              inline
              onClick={() => handleDownloadNai(tagString, '_nai_tags.png')}
              disabled={loadingState.tags || processedTags.length === 0 || isEmbedding || !selectedFile}
              className="gap-1.5 text-xs disabled:opacity-50"
              aria-label={t('results.downloadNai')}
            >
              {isEmbedding
                ? <Preloader className="w-3.5 h-3.5" />
                : <Download className="w-3.5 h-3.5" aria-hidden="true" />}
              {t('results.naiReady')}
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-[300px] bg-md-light-surface-2 dark:bg-md-dark-surface-2 rounded-3xl p-4 transition-colors duration-300">
          {loadingState.tags ? (
            <div className="flex flex-col items-center justify-center h-full space-y-6 py-8" role="status" aria-live="polite">
              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between text-xs font-medium text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant">
                  <span>{loadingState.status || t('results.processing')}</span>
                  <span>{Math.round(loadingState.progress)}%</span>
                </div>
                <Progressbar progress={Math.max(0.05, loadingState.progress / 100)} className="h-2 rounded-full" />
              </div>
              <div className="flex flex-wrap gap-2 animate-pulse opacity-30 justify-center max-w-lg blur-[1px]" aria-hidden="true">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="h-8 bg-md-light-surface-5 dark:bg-md-dark-surface-5 rounded-lg w-16" />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {processedTags.map(tag => (
                <button
                  key={tag.name}
                  onClick={() => {
                    navigator.clipboard.writeText(formatTag(tag.name));
                    showToast(t('results.copiedItem', { item: formatTag(tag.name) }));
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium cursor-pointer transition-all hover:scale-105 active:scale-95 ${getCategoryColor(tag.category)}`}
                  title={`${t('results.score')}: ${(tag.score * 100).toFixed(0)}%`}
                  aria-label={`${formatTag(tag.name)}, ${t('results.score')}: ${(tag.score * 100).toFixed(0)}%`}
                >
                  <span className="opacity-50" aria-hidden="true">{getCategoryIcon(tag.category)}</span>
                  <span className="font-mono font-medium">{formatTag(tag.name)}</span>
                  <span className="ml-1 text-[10px] font-bold opacity-60 bg-black/10 dark:bg-black/20 px-1.5 py-0.5 rounded" aria-hidden="true">
                    {tag.score.toFixed(2)}
                  </span>
                </button>
              ))}
              {processedTags.length === 0 && (
                <div className="w-full text-center py-12 text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant opacity-60">
                  <TagIcon className="w-12 h-12 mx-auto mb-3 opacity-20" aria-hidden="true" />
                  <p>{t('results.noTags')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Raw tag string */}
        {!loadingState.tags && processedTags.length > 0 && (
          <div className="bg-md-light-surface-2 dark:bg-md-dark-surface-2 rounded-2xl transition-colors duration-300 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1">
              <span className="text-2xs font-semibold uppercase tracking-wider text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant opacity-50">
                {t('results.technicalTags')}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  small
                  rounded
                  tonal
                  inline
                  onClick={handleCopyTags}
                  className="gap-1 text-2xs disabled:opacity-50"
                  aria-label={copiedTags ? t('results.copied') : t('results.copyAll')}
                >
                  {copiedTags ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                  {copiedTags ? t('results.copied') : t('results.copyAll')}
                </Button>
                <Button
                  small
                  rounded
                  tonal
                  inline
                  onClick={handleCopyA1111}
                  className="gap-1 text-2xs disabled:opacity-50"
                  aria-label={copiedA1111 ? t('results.copied') : 'A1111 (ComfyUI)'}
                >
                  {copiedA1111 ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                  {copiedA1111 ? t('results.copied') : 'A1111 (ComfyUI)'}
                </Button>
              </div>
            </div>
            <p className="px-3 pb-3 text-xs text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant font-mono wrap-break-word opacity-80 select-all leading-relaxed">
              {tagString}
            </p>
          </div>
        )}
      </div>

      {/* Artist Similarity (Kaloscope) */}
      {(isMatchingArtists || (artistMatches && artistMatches.length > 0)) && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-md-light-on-surface dark:text-md-dark-on-surface uppercase tracking-wider flex items-center gap-2">
            <Palette className="w-4 h-4" aria-hidden="true" />
            {t('results.artistSimilarity')}
            <span className="bg-md-light-surface-3 dark:bg-md-dark-surface-3 px-2 py-0.5 rounded-full text-[10px] font-normal normal-case tracking-normal text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant">
              Kaloscope 2.0
            </span>
          </h3>

          <div className="bg-md-light-surface-2 dark:bg-md-dark-surface-2 rounded-3xl p-4 transition-colors duration-300">
            {isMatchingArtists ? (
              <div className="flex items-center justify-center gap-3 py-6 text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant" role="status" aria-live="polite">
                <Preloader className="w-5 h-5" />
                <span className="text-sm">{t('results.matchingArtists')}</span>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {artistMatches!.map((artist, i) => {
                  const isTop = i < 5;
                  return (
                    <li key={artist.name} className={`flex items-center gap-1 rounded-xl transition-opacity ${!isTop ? 'opacity-40 hover:opacity-70' : ''}`}>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(formatTag(artist.name));
                          showToast(t('results.copiedItem', { item: formatTag(artist.name) }));
                        }}
                        className="flex-1 flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-md-light-surface-4 dark:hover:bg-md-dark-surface-4 transition-colors text-left cursor-pointer min-w-0"
                        title={t('results.copyArtist')}
                      >
                        <span className={`w-5 shrink-0 text-center text-xs font-bold tabular-nums ${isTop ? 'text-primary dark:text-md-dark-primary' : 'text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant'}`}>
                          {i + 1}
                        </span>
                        <span className="flex-1 min-w-0 text-sm font-medium font-mono truncate text-md-light-on-surface dark:text-md-dark-on-surface">
                          {formatTag(artist.name)}
                        </span>
                      </button>
                      <a
                        href={`https://danbooru.donmai.us/artists/show_or_new?name=${encodeURIComponent(artist.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 p-1.5 rounded-lg text-md-light-on-surface-variant dark:text-md-dark-on-surface-variant hover:text-primary dark:hover:text-md-dark-primary hover:bg-md-light-surface-4 dark:hover:bg-md-dark-surface-4 transition-colors"
                        title="Open on Danbooru"
                        aria-label={`Open ${formatTag(artist.name)} on Danbooru`}
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {toastMessage && createPortal(
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200" role="status" aria-live="polite">
          <div className="bg-stone-950/90 dark:bg-white/90 text-white dark:text-stone-900 px-4 py-2 rounded-full shadow-lg backdrop-blur-sm flex items-center gap-2 text-sm font-medium">
            <Check className="w-4 h-4 text-green-500 dark:text-green-600" aria-hidden="true" />
            {toastMessage}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
