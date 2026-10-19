import { describe, expect, it } from 'vitest';
import { renderJson, renderTable } from '../dist/report.js';
import type { FileStatistics } from '../dist/types.js';

const rows: FileStatistics[] = [
  {
    file: 'a.md',
    chineseCharacters: 2,
    topWords: [{ word: '写作', count: 1 }],
  },
  {
    file: 'line\nbreak.md',
    chineseCharacters: 0,
    topWords: [],
  },
];

describe('report renderers', () => {
  it('renders table headers, words, and an empty marker', () => {
    const table = renderTable(rows);
    expect(table).toContain('文件');
    expect(table).toContain('中文字数');
    expect(table).toContain('高频词（次数）');
    expect(table).toContain('a.md');
    expect(table).toContain('写作(1)');
    expect(table).toContain('—');
    expect(table).toContain('line\\u000Abreak.md');
    expect(table).not.toContain('line\nbreak.md');
  });

  it('renders two-space JSON with a trailing newline', () => {
    const json = renderJson(rows);
    expect(JSON.parse(json)).toEqual(rows);
    expect(json.endsWith('\n')).toBe(true);
    expect(json).toContain('\n  {');
  });

  it('renders an empty result as []', () => {
    expect(renderJson([])).toBe('[]\n');
  });
});
