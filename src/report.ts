import Table from 'cli-table3';
import type { FileStatistics, WordFrequency } from './types.js';

function escapeControlCharacters(value: string): string {
  return value.replace(
    /[\u0000-\u001f\u007f-\u009f]/gu,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()}`,
  );
}

function formatWords(words: WordFrequency[]): string {
  return words.length === 0
    ? '—'
    : words.map((entry) => `${entry.word}(${entry.count})`).join('、');
}

export function renderTable(rows: FileStatistics[]): string {
  const table = new Table({
    head: ['文件', '中文字数', '高频词（次数）'],
    wordWrap: true,
  });
  for (const row of rows) {
    table.push([
      escapeControlCharacters(row.file),
      String(row.chineseCharacters),
      formatWords(row.topWords),
    ]);
  }
  return `${table.toString()}\n`;
}

export function renderJson(rows: FileStatistics[]): string {
  return `${JSON.stringify(rows, null, 2)}\n`;
}
