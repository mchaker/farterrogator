import { ArtistMatch, I18nError } from '../types';
import { resolveApiUrl } from './taggerService';

const KALOSCOPE_PATH = '/kaloscope/infer';

export const fetchArtistMatches = async (
  file: File,
  baseUrl: string,
  topK: number = 10
): Promise<ArtistMatch[]> => {
  const endpoint = resolveApiUrl(baseUrl, KALOSCOPE_PATH);

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${endpoint}?top_k=${topK}`, { method: 'POST', body: formData });
  if (!response.ok) throw new I18nError('errors.kaloscopeError', { status: response.status, statusText: response.statusText });

  const data = await response.json();
  if (!Array.isArray(data?.artists)) return [];

  return data.artists
    .filter((a: any) => a && typeof a.name === 'string')
    .map((a: any) => ({ name: a.name, score: Number(a.score) || 0 }));
};
