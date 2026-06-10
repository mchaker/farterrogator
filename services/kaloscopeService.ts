import { ArtistMatch } from '../types';

const KALOSCOPE_PATH = '/kaloscope/infer';

// Mirrors taggerService.buildEndpoint: gpu.garden goes through the CORS proxy,
// localhost goes through the Vite dev proxy.
function buildEndpoint(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '');

  if (base.includes('localtagger.gpu.garden')) {
    return `/interrogate/gpu-garden${KALOSCOPE_PATH}`;
  }

  if (base.includes('localhost') || base.includes('127.0.0.1')) {
    return KALOSCOPE_PATH;
  }

  return `${base}${KALOSCOPE_PATH}`;
}

export const fetchArtistMatches = async (
  file: File,
  baseUrl: string,
  topK: number = 10
): Promise<ArtistMatch[]> => {
  const endpoint = buildEndpoint(baseUrl);

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${endpoint}?top_k=${topK}`, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`Kaloscope error: ${response.status} ${response.statusText}`);

  const data = await response.json();
  if (!Array.isArray(data?.artists)) return [];

  return data.artists
    .filter((a: any) => a && typeof a.name === 'string')
    .map((a: any) => ({ name: a.name, score: Number(a.score) || 0 }));
};
