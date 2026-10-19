import { compareCodePoints } from './ordering.js';
import { STOPWORDS } from './stopwords.js';
import type {
  FileStatistics,
  Tokenizer,
  WordFrequency,
} from './types.js';

const HAN_CHARACTER = /\p{Script=Han}/gu;
const ELIGIBLE_WORD = /^\p{Script=Han}{2,}$/u;

export function normalizeText(text: string): string {
  return text.normalize('NFC');
}

export function countChineseCharacters(text: string): number {
  return Array.from(text.matchAll(HAN_CHARACTER)).length;
}

export function countWords(
  prose: string,
  tokenizer: Tokenizer,
): WordFrequency[] {
  const counts = new Map<string, number>();
  for (const token of tokenizer.cut(prose)) {
    const word = token.trim();
    if (!ELIGIBLE_WORD.test(word) || STOPWORDS.has(word)) {
      continue;
    }
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return Array.from(counts, ([word, count]) => ({ word, count }));
}

export function rankTopWords(
  counts: WordFrequency[],
  limit = 10,
): WordFrequency[] {
  return [...counts]
    .sort(
      (a, b) =>
        b.count - a.count || compareCodePoints(a.word, b.word),
    )
    .slice(0, limit);
}

export function analyzeProse(
  file: string,
  prose: string,
  tokenizer: Tokenizer,
): FileStatistics {
  const normalized = normalizeText(prose);
  return {
    file,
    chineseCharacters: countChineseCharacters(normalized),
    topWords: rankTopWords(countWords(normalized, tokenizer)),
  };
}

export async function createJiebaTokenizer(): Promise<Tokenizer> {
  const jieba = await import('@node-rs/jieba');
  return {
    cut: (text: string) => jieba.cut(text, true),
  };
}
