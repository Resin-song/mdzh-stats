import { describe, expect, it } from 'vitest';
import { extractProse } from '../dist/extract.js';

describe('extractProse', () => {
  it('returns visible Markdown prose only', () => {
    const markdown = [
      '---',
      'title: 不应统计',
      '---',
      '# 写作',
      '',
      '写作让人看见。',
      '',
      '```js',
      '不应统计',
      '```',
      '',
      '访问 https://example.com/不应统计',
      '',
      '[写作](https://example.com/不应统计)',
      '',
      '![时间](x.png)',
      '',
      '<!-- 不应统计 -->',
      '',
      '<div>',
      '不应统计',
      '</div>',
    ].join('\n');

    expect(extractProse(markdown)).toEqual([
      '写作',
      '写作让人看见。',
      '访问',
      '写作',
      '时间',
    ]);
  });

  it('keeps separate Markdown blocks as separate fragments', () => {
    expect(extractProse('写作\n\n时间')).toEqual(['写作', '时间']);
  });
});
