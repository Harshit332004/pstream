export type Subtitle = {
  label: string;
  url: string;
};

export function filterEnglishSubtitles(subtitles: Subtitle[]): Subtitle[] {
  if (!subtitles || subtitles.length === 0) return [];

  const englishRegex = /\beng(?:lish)?\b/i;
  const englishVariants = /\beng(-|_)?(cc|sdh)?\b/i;

  const validSubs = subtitles.filter(sub => {
    const label = sub.label.toLowerCase();
    return englishRegex.test(label) || englishVariants.test(label) || ['en', 'eng', 'english', 'english cc', 'english sdh'].includes(label);
  });

  return validSubs.map(sub => ({
    label: 'English',
    url: sub.url,
  }));
}
