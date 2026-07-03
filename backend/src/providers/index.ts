import { vidlinkProvider } from './vidlink';
import { movieboxProvider } from './moviebox';
import { vidsrcProvider } from './vidsrc';
import { vidnestProvider } from './vidnest';
import { videasyProvider } from './videasy';

export type NormalizedResponse = {
  provider: string;
  fallback: boolean;
  quality: string;
  stream: string;
  subtitles: Array<{ label: string; url: string }>;
  raw?: any;
};

export interface Provider {
  fetchMovie(tmdbId: string): Promise<NormalizedResponse | null>;
  fetchTV(tmdbId: string, season: number, episode: number): Promise<NormalizedResponse | null>;
}

const providers: Provider[] = [
  vidlinkProvider,
  movieboxProvider,
  vidsrcProvider,
  vidnestProvider,
  videasyProvider,
];

export async function getProviderMovie(tmdbId: string): Promise<NormalizedResponse | null> {
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    try {
      const result = await provider.fetchMovie(tmdbId);
      if (result && result.stream) {
        if (i > 0) result.fallback = true;
        return result;
      }
    } catch (error) {
      console.debug(`Provider ${i} failed for movie ${tmdbId}:`, error);
    }
  }
  return null;
}

export async function getProviderTv(tmdbId: string, season: number, episode: number): Promise<NormalizedResponse | null> {
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    try {
      const result = await provider.fetchTV(tmdbId, season, episode);
      if (result && result.stream) {
        if (i > 0) result.fallback = true;
        return result;
      }
    } catch (error) {
      console.debug(`Provider ${i} failed for tv ${tmdbId} S${season}E${episode}:`, error);
    }
  }
  return null;
}

