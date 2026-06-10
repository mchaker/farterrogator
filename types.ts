export type TagCategory = 'general' | 'character' | 'copyright' | 'artist' | 'meta' | 'rating';

export type TaggerModel = 'wd' | 'pixai' | 'camie' | 'taggerine';

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
  taggerModel: TaggerModel;
  taggerBaseUrl: string;
}

export interface TaggingSettings {
  thresholds: Record<TagCategory, number>;
  topK: number;
  maxTags: number;
  triggerPhrase: string;
  randomize: boolean;
  removeUnderscores: boolean;
}

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
