export type ReadingTime = {
  words: number;
  minutes: number;
  text: string;
  timeMs: number;
};

export function estimateReadingTime(content: string, wordsPerMinute: number = 200): ReadingTime {
  if (!content) {
    return { words: 0, minutes: 0, text: '0 min read', timeMs: 0 };
  }

  const normalized = content
    .replace(/```[\s\S]*?```/g, ' ') // code blocks
    .replace(/`[^`]*`/g, ' ') // inline code
    .replace(/<[^>]*>/g, ' ') // html tags
    .replace(/[#*_>\-]+/g, ' ') // markdown syntax
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ') // markdown links [text](url)
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();

  const words = normalized ? normalized.split(/\s+/).length : 0;
  if (words === 0) {
    return { words: 0, minutes: 0, text: '0 min read', timeMs: 0 };
  }

  const minutesFloat = words / Math.max(1, wordsPerMinute);
  const minutes = Math.max(1, Math.ceil(minutesFloat));
  const timeMs = Math.round(minutesFloat * 60 * 1000);
  const text = `${minutes} min read`;

  return { words, minutes, text, timeMs };
}
