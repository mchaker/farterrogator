import { Tag, BackendConfig, TagCategory, InterrogationResult, TaggingSettings, BatchResult, TaggerModel } from "../types";
import { getCategory, loadTagDatabase } from './tagService';

const MODEL_PATHS: Record<TaggerModel, string> = {
  wd: '/interrogate/eva',
  pixai: '/interrogate/pixai',
  camie: '/interrogate/camie',
  taggerine: '/interrogate/taggerine',
};

function buildEndpoint(baseUrl: string, model: TaggerModel): string {
  const path = MODEL_PATHS[model];
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

const MIME_TYPE_PATTERN = /^[^/]+\/[^/]+$/;

function getExtensionFromMimeType(mime: string): string {
  if (!mime || mime.trim() === '' || !MIME_TYPE_PATTERN.test(mime)) return 'bin';
  const [, subtype] = mime.split('/');
  return subtype.split('+')[0] || 'bin';
}

function parseTags(data: any): Tag[] {
  const tags: Tag[] = [];
  let tagsData = data.tags;

  if (Array.isArray(data) && data.length > 0 && data[0].tags) {
    tagsData = data[0].tags;
  }

  if (!tagsData) return tags;

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
        tags.push({ name, score: score > 1.0 ? score / 100 : score, category: getCategory(name) });
      }
    });
  } else if (typeof tagsData === 'object') {
    Object.entries(tagsData).forEach(([name, score]) => {
      let normalizedScore = Number(score);
      if (normalizedScore > 1.0) normalizedScore /= 100;
      tags.push({ name, score: normalizedScore, category: getCategory(name) });
    });
  }

  return tags.filter(tag => {
    if (['blue_skin', 'colored_skin'].includes(tag.name) && tag.score < 0.85) return false;
    return true;
  });
}

export const fetchTags = async (
  base64Image: string,
  config: BackendConfig,
  settings?: TaggingSettings,
  mimeType?: string
): Promise<Tag[]> => {
  const endpoint = buildEndpoint(config.taggerBaseUrl, config.taggerModel);
  const normalizedMime = mimeType?.trim() || 'image/png';

  let blob: Blob;
  try {
    const byteArray = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));
    blob = new Blob([byteArray], { type: normalizedMime });
  } catch (error) {
    throw new Error(`Failed to decode image data: ${error}`);
  }

  const ext = getExtensionFromMimeType(normalizedMime);
  const formData = new FormData();
  formData.append('file', blob, `image.${ext}`);

  const queryParams = new URLSearchParams();
  if (settings) {
    if (settings.maxTags > 0) queryParams.append('max_tags', Math.floor(settings.maxTags).toString());
    queryParams.append('threshold', settings.thresholds.general.toString());
  } else {
    queryParams.append('threshold', '0.35');
  }

  const finalUrl = `${endpoint}?${queryParams}`;

  const response = await fetch(finalUrl, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Tagger error: ${response.status} ${response.statusText}`);

  const data = await response.json();
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
  const endpoint = buildEndpoint(config.taggerBaseUrl, config.taggerModel);

  const formData = new FormData();
  files.forEach(file => formData.append('file', file));

  const queryParams = new URLSearchParams();
  queryParams.append('output_format', 'zip');
  if (settings) {
    // Whitelist tags are prepended server-side into the per-image .txt files
    if (settings.whitelist?.trim()) queryParams.append('trigger_word', settings.whitelist.trim());
    if (settings.randomize) queryParams.append('random_order', 'true');
    queryParams.append('threshold', settings.thresholds.general.toString());
  } else {
    queryParams.append('threshold', '0.35');
  }

  const finalUrl = `${endpoint}?${queryParams}`;
  const response = await fetch(finalUrl, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Batch tagger error: ${response.status} ${response.statusText}`);

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

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const generateTags = async (
  base64Image: string,
  mimeType: string,
  config: BackendConfig,
  settings?: TaggingSettings,
  _language?: string,
  onProgress?: (status: string, progress: number) => void
): Promise<InterrogationResult> => {
  await loadTagDatabase();
  onProgress?.('Analyzing image...', 20);
  const tags = await fetchTags(base64Image, config, settings, mimeType);
  onProgress?.('Done', 100);
  return { tags };
};
