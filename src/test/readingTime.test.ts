import { estimateReadingTime } from '../utils/readingTime';

describe('Reading Time', () => {

  it('estimateReadingTime should handle empty content', () => {
    const rt = estimateReadingTime('');
    expect(rt.words).toBe(0);
    expect(rt.minutes).toBe(0);
    expect(rt.text).toBe('0 min read');
  });

  it('estimateReadingTime should compute minutes from words', () => {
    const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ');
    const rt = estimateReadingTime(words);
    expect(rt.words).toBeGreaterThanOrEqual(400);
    expect(rt.minutes).toBeGreaterThanOrEqual(2);
    expect(rt.text).toMatch(/min read$/);
  });
});
