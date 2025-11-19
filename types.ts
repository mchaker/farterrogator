
export type TagCategory = 'general' | 'character' | 'copyright' | 'artist' | 'meta' | 'rating';

export type BackendType = 'gemini' | 'local_hybrid';

export interface Tag {
  name: string;
  score: number;
  category: TagCategory;
  source?: 'local' | 'ollama' | 'both';
}

export interface InterrogationResult {
  naturalDescription?: string;
  tags: Tag[];
}

export interface BackendConfig {
  type: BackendType;

  // Gemini Specifics
  geminiApiKey: string;

  // Local Hybrid Specifics (Ollama + Local Tagger)
  ollamaEndpoint: string;
  ollamaModel: string; // e.g., 'qwen2.5-vl'
  taggerEndpoint: string; // e.g., 'http://localhost:8000/tag'
  enableNaturalLanguage: boolean; // Toggle for natural language output
}

export interface TaggingSettings {
  thresholds: Record<TagCategory, number>;
  topK: number;
  randomize: boolean;
  removeUnderscores: boolean;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface LoadingState {
  tags: boolean;
  description: boolean;
  progress: number;
  status: string;
}
