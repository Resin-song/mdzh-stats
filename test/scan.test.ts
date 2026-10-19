import { symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { RootPathError, scanMarkdownFiles, shouldEnterDirectory } from '../dist/scan.js';
import { createTempTree, writeUtf8 } from './helpers/temp-tree.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()!();
  }
});

async function fixture() {
  const tree = await createTempTree();
  cleanups.push(tree.cleanup);
  return tree;
}

describe('scanMarkdownFiles', () => {
  it('returns supported files recursively in stable order', async () => {
    const { root } = await fixture();
    await writeUtf8(root, 'z.md', '写作');
    await writeUtf8(root, 'a.md', '时间');
    await writeUtf8(root, 'B.MARKDOWN', '阅读');
    await writeUtf8(root, 'sub/c.md', '正文');
    await writeUtf8(root, '.private/d.md', '隐藏');
    await writeUtf8(root, 'note.txt', '忽略');

    const result = await scanMarkdownFiles(root);

    expect(result.files.map((file) => file.displayPath)).toEqual([
      'B.MARKDOWN',
      'a.md',
      'sub/c.md',
      'z.md',
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it('does not follow a symlinked directory', async () => {
    const { root } = await fixture();
    const outside = join(root, 'outside');
    await writeUtf8(outside, 'hidden.md', '不应统计');
    const scanRoot = join(root, 'scan');
    await writeUtf8(scanRoot, 'inside.md', '正文');
    await symlink(outside, join(scanRoot, 'linked'), 'junction');

    const result = await scanMarkdownFiles(scanRoot);

    expect(result.files.map((file) => file.displayPath)).toEqual(['inside.md']);
  });

  it('centralizes hidden and symlink directory decisions', () => {
    expect(shouldEnterDirectory('.private', false)).toBe(false);
    expect(shouldEnterDirectory('linked', true)).toBe(false);
    expect(shouldEnterDirectory('notes', false)).toBe(true);
  });

  it('returns a single file when the input is a regular file', async () => {
    const { root } = await fixture();
    const file = join(root, 'file.md');
    await writeFile(file, '正文', 'utf8');

    const result = await scanMarkdownFiles(file);

    expect(result.files).toEqual([
      {
        absolutePath: file,
        displayPath: 'file.md',
      },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it('throws RootPathError for a missing input path', async () => {
    const { root } = await fixture();

    await expect(
      scanMarkdownFiles(join(root, 'missing.md')),
    ).rejects.toBeInstanceOf(RootPathError);
  });
});
