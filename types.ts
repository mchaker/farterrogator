export type TagCategory = 'general' | 'character' | 'copyright' | 'artist' | 'meta' | 'rating';

// One entry of the backend's GET /models response. `id` is what goes into
// ?model= and doubles as the i18n key; label/description are english fallbacks.
export interface TaggerModelInfo {
  id: string;
  label: string;
  description: string;
  family: string;
  recommended: boolean;
  gated: boolean;
  loaded: boolean;
  default_threshold: number;
  default_character_threshold: number;
}

export interface Tag {
  name: string;
  score: number;
  category: TagCategory;
}

export interface InterrogationResult {
  tags: Tag[];
}

export interface ArtistMatch {
  name: string;
  score: number;
}

export interface BatchResult {
  tags: Record<string, number>;
  tag_string: string;
}

export interface BackendConfig {
  taggerModel: string; // model id from GET /models
  taggerBaseUrl: string;
}

export interface TaggingSettings {
  thresholds: Record<TagCategory, number>;
  topK: number;
  maxTags: number;
  whitelist: string;
  blacklist: string;
  randomize: boolean;
  removeUnderscores: boolean;
  // Passed straight through to the backend's /interrogate query params.
  useEscape: boolean; // escape () in tag names (default true)
  includeRanks: boolean; // append (tag:score) to tag_string (default false)
  scoreDescend: boolean; // sort tags by score descending (default true)
}

// Result of the GET /health probe. `unknown` means the server answered but has
// no /health route (an older backend) — distinct from `down` (unreachable), so
// the UI can degrade gracefully instead of locking up old deployments.
export type BackendHealth = 'ok' | 'down' | 'unknown';

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface LoadingState {
  tags: boolean;
  progress: number;
  status: string;
}

// Error carrying an i18n key + params instead of a fixed-language message,
// so services stay translation-agnostic and the UI layer calls t()
export class I18nError extends Error {
  key: string;
  params?: Record<string, string | number>;

  constructor(key: string, params?: Record<string, string | number>) {
    super(key);
    this.name = 'I18nError';
    this.key = key;
    this.params = params;
  }
}
