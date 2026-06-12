import { Tag, BackendConfig, TagCategory, InterrogationResult, TaggingSettings, BatchResult, TaggerModelInfo, I18nError } from "../types";
import { getCategory, loadTagDatabase } from './tagService';

// gpu.garden goes through the CORS proxy (Vite dev proxy / Cloudflare Pages
// function), localhost goes through the Vite dev proxy, anything else is hit
// directly.
export function resolveApiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, '');

  if (base.includes('localtagger.gpu.garden')) {
    return `/interrogate/gpu-garden${path}`;
  }

  if (base.includes('localhost') || base.includes('127.0.0.1')) {
    return path;
  }

  return `${base}${path}`;
}

// Tags are compared case-insensitively with underscores and spaces equivalent
export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/ /g, '_');
}

export function parseTagList(value?: string): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map(normalizeTagName)
      .filter(Boolean)
  );
}

// These tags are noisy false positives below high confidence
const LOW_CONFIDENCE_SKIN_TAGS = new Set(['blue_skin', 'colored_skin']);

function parseTags(data: any): Tag[] {
  const tags: Tag[] = [];
  const entry = Array.isArray(data) ? data[0] : data;
  const tagsData = entry?.tags;

  if (!tagsData) return tags;

  // The response's `character` map is authoritative for character tags;
  // anything else is categorized via the local tag database.
  const characterNames = new Set(Object.keys(entry?.character ?? {}));
  const categorize = (name: string): TagCategory =>
    characterNames.has(name) ? 'character' : getCategory(name);

  if (Array.isArray(tagsData)) {
    tagsData.forEach((item: any) => {
      let name = '';
      let score = 0;
      if (Array.isArray(item)) {
        name = item[0];
        score = Number(item[1]);
      } else if (typeof item === 'object') {
        name = item.name || item.tag;
        score = Number(item.score ?? item.confidence ?? item.probability ?? 0);
      }
      if (name) {
        tags.push({ name, score: score > 1.0 ? score / 100 : score, category: categorize(name) });
      }
    });
  } else if (typeof tagsData === 'object') {
    Object.entries(tagsData).forEach(([name, score]) => {
      let normalizedScore = Number(score);
      if (normalizedScore > 1.0) normalizedScore /= 100;
      tags.push({ name, score: normalizedScore, category: categorize(name) });
    });
  }

  return tags.filter(tag => !(LOW_CONFIDENCE_SKIN_TAGS.has(tag.name) && tag.score < 0.85));
}

export const fetchAvailableModels = async (baseUrl: string): Promise<TaggerModelInfo[]> => {
  const response = await fetch(resolveApiUrl(baseUrl, '/models'));
  if (!response.ok) throw new I18nError('errors.taggerError', { status: response.status, statusText: response.statusText });

  const data = await response.json();
  if (!Array.isArray(data?.models)) return [];
  return data.models.filter((m: any) => m && typeof m.id === 'string');
};

export const fetchTags = async (
  image: File,
  config: BackendConfig,
  settings?: TaggingSettings
): Promise<Tag[]> => {
  const endpoint = resolveApiUrl(config.taggerBaseUrl, '/interrogate');

  const formData = new FormData();
  formData.append('file', image);

  const queryParams = new URLSearchParams();
  queryParams.append('model', config.taggerModel);
  if (settings) {
    queryParams.append('threshold', settings.thresholds.general.toString());
    queryParams.append('character_threshold', settings.thresholds.character.toString());
  } else {
    queryParams.append('threshold', '0.35');
    queryParams.append('character_threshold', '0.85');
  }

  const finalUrl = `${endpoint}?${queryParams}`;

  // The tag database is only needed to categorize the response, so let it
  // download in parallel with the interrogation request.
  const tagDbPromise = loadTagDatabase();
  const response = await fetch(finalUrl, { method: 'POST', body: formData });
  if (!response.ok) throw new I18nError('errors.taggerError', { status: response.status, statusText: response.statusText });

  const data = await response.json();
  await tagDbPromise;
  const tags = parseTags(data).sort((a, b) => b.score - a.score);

  if (settings?.maxTags && settings.maxTags > 0) {
    return tags.slice(0, settings.maxTags);
  }
  return tags;
};

export const fetchBatchTags = async (
  files: File[],
  config: BackendConfig,
  settings?: TaggingSettings
): Promise<Record<string, BatchResult>> => {
  const endpoint = resolveApiUrl(config.taggerBaseUrl, '/interrogate');

  const formData = new FormData();
  files.forEach(file => formData.append('file', file));

  const queryParams = new URLSearchParams();
  queryParams.append('output_format', 'zip');
  queryParams.append('model', config.taggerModel);
  if (settings) {
    // Whitelist tags are prepended server-side into the per-image .txt files
    if (settings.whitelist?.trim()) queryParams.append('trigger_word', settings.whitelist.trim());
    if (settings.randomize) queryParams.append('random_order', 'true');
    if (settings.removeUnderscores) queryParams.append('use_spaces', 'true');
    queryParams.append('threshold', settings.thresholds.general.toString());
    queryParams.append('character_threshold', settings.thresholds.character.toString());
  } else {
    queryParams.append('threshold', '0.35');
    queryParams.append('character_threshold', '0.85');
  }

  const finalUrl = `${endpoint}?${queryParams}`;
  const response = await fetch(finalUrl, { method: 'POST', body: formData });
  if (!response.ok) throw new I18nError('errors.batchTaggerError', { status: response.status, statusText: response.statusText });

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/zip') || contentType.includes('application/octet-stream')) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cd = response.headers.get('content-disposition') ?? '';
    const match = cd.match(/filename="?([^"]+)"?/);
    a.download = match?.[1] ?? 'batch_tags.zip';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return {};
  }

  const data = await response.json();

  const blacklist = parseTagList(settings?.blacklist);
  const normalize = (entries: [string, unknown][]): { tag: string; score: number }[] => {
    return entries
      .map(([tag, score]) => {
        let s = Number(score);
        if (s > 1.0) s /= 100;
        return { tag, score: s };
      })
      .filter(e => !blacklist.has(normalizeTagName(e.tag)));
  };

  if (Array.isArray(data)) {
    const result: Record<string, BatchResult> = {};
    data.forEach((item, idx) => {
      const filename = files[idx]?.name ?? `image_${idx}.png`;
      if (!item?.tags) return;
      let entries = normalize(Object.entries(item.tags)).sort((a, b) => b.score - a.score);
      if (settings?.maxTags && settings.maxTags > 0) entries = entries.slice(0, settings.maxTags);
      const tags: Record<string, number> = {};
      entries.forEach(e => (tags[e.tag] = e.score));
      result[filename] = { tags, tag_string: entries.map(e => e.tag).join(', ') };
    });
    return result;
  }

  if (data && typeof data === 'object') {
    Object.keys(data).forEach(filename => {
      const item = data[filename];
      if (!item?.tags) return;
      let entries = normalize(Object.entries(item.tags)).sort((a, b) => b.score - a.score);
      if (settings?.maxTags && settings.maxTags > 0) entries = entries.slice(0, settings.maxTags);
      const tags: Record<string, number> = {};
      entries.forEach(e => (tags[e.tag] = e.score));
      item.tags = tags;
      item.tag_string = entries.map(e => e.tag).join(', ');
    });
    return data;
  }

  return data;
};

export const generateTags = async (
  image: File,
  config: BackendConfig,
  settings?: TaggingSettings,
  _language?: string,
  // statusKey is an i18n key (like I18nError); the UI layer calls t()
  onProgress?: (statusKey: string, progress: number) => void
): Promise<InterrogationResult> => {
  onProgress?.('status.analyzingImage', 20);
  const tags = await fetchTags(image, config, settings);
  onProgress?.('status.done', 100);
  return { tags };
};
