const qualityPriorities: Record<string, number> = {
  '2160p': 6,
  '1440p': 5,
  '1080p': 4,
  '720p': 3,
  '480p': 2,
  '360p': 1,
};

export type StreamCandidate = {
  url: string;
  quality: string;
  format?: 'MP4' | 'HLS' | 'DASH';
};

export function normalizeQuality(rawQuality: string): string | null {
  const q = rawQuality.toLowerCase();
  if (q.includes('2160')) return '2160p';
  if (q.includes('1440')) return '1440p';
  if (q.includes('1080')) return '1080p';
  if (q.includes('720')) return '720p';
  if (q.includes('480')) return '480p';
  if (q.includes('360')) return '360p';
  return null;
}

export function selectBestStream(candidates: StreamCandidate[]): StreamCandidate | null {
  if (!candidates || candidates.length === 0) return null;

  let bestCandidate: StreamCandidate | null = null;
  let highestPriority = -1;

  for (const candidate of candidates) {
    const normalized = normalizeQuality(candidate.quality);
    if (!normalized) continue;

    const priority = qualityPriorities[normalized] || 0;
    if (priority > highestPriority) {
      highestPriority = priority;
      bestCandidate = { ...candidate, quality: normalized };
    } else if (priority === highestPriority && bestCandidate) {
      // Prefer MP4 over HLS if qualities are equal
      if (candidate.format === 'MP4' && bestCandidate.format !== 'MP4') {
        bestCandidate = { ...candidate, quality: normalized };
      }
    }
  }

  // If no candidates matched known qualities, return the first one as fallback, assuming it's the best or only option
  if (!bestCandidate && candidates.length > 0) {
      return candidates[0];
  }

  return bestCandidate;
}
