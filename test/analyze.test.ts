import { describe, expect, it } from 'vitest';
import {
  analyzeProse,
  countChineseCharacters,
  countWords,
  createJiebaTokenizer,
  rankTopWords,
} from '../dist/analyze.js';
import { compareCodePoints } from '../dist/ordering.js';
import type { Tokenizer } from '../dist/types.js';

const fakeTokenizer: Tokenizer = {
  cut: () => ['我们', '写作', 'A1', '时间', '看'],
};
const writingTokenizer: Tokenizer = {
  cut: () => ['写作'],
};

describe('Chinese analysis', () => {
  it('counts every Unicode Han script character only', () => {
    expect(countChineseCharacters('写作 A1，时间。𠀀')).toBe(5);
  });

  it('removes stopwords and invalid tokens', () => {
    expect(countWords('ignored', fakeTokenizer)).toEqual([
      { word: '写作', count: 1 },
      { word: '时间', count: 1 },
    ]);
  });

  it('ranks by count descending then Unicode code point', () => {
    expect(
      rankTopWords([
        { word: '看见', count: 1 },
        { word: '写作', count: 2 },
        { word: '时间', count: 1 },
      ]),
    ).toEqual([
      { word: '写作', count: 2 },
      { word: '时间', count: 1 },
      { word: '看见', count: 1 },
    ]);
    expect(compareCodePoints('写作', '时间')).toBeLessThan(0);
  });

  it('returns at most ten entries', () => {
    const counts = Array.from({ length: 12 }, (_, index) => ({
      word: `词${String.fromCodePoint(0x4e00 + index)}`,
      count: index,
    }));
    expect(rankTopWords(counts)).toHaveLength(10);
  });

  it('analyzes a file with an injected tokenizer', () => {
    expect(analyzeProse('a.md', '写作 A1。', writingTokenizer)).toEqual({
      file: 'a.md',
      chineseCharacters: 2,
      topWords: [{ word: '写作', count: 1 }],
    });
  });

  it('initializes the jieba adapter', async () => {
    const tokenizer = await createJiebaTokenizer();
    const result = analyzeProse('a.md', '写作让人看见。', tokenizer);
    expect(result.chineseCharacters).toBe(6);
    expect(result.topWords.some((entry) => entry.word === '写作')).toBe(true);
  });
});
