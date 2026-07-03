import { LRUCache } from 'lru-cache';
import { config } from '../config';

export const cache = new LRUCache<string, any>({
  max: 500,
  ttl: config.cacheTtlSeconds * 1000,
});

export function getCacheKey(provider: string, type: 'movie' | 'tv', tmdbId: string, season?: number, episode?: number) {
  if (type === 'movie') {
    return `${provider}:movie:${tmdbId}`;
  }
  return `${provider}:tv:${tmdbId}:${season}:${episode}`;
}
