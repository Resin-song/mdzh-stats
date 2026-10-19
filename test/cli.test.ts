import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { run } from '../dist/cli.js';
import type { Tokenizer } from '../dist/types.js';
import {
  createTempTree,
  writeBytes,
  writeUtf8,
} from './helpers/temp-tree.js';

const cleanups: Array<() => Promise<void>> = [];
const tokenizer: Tokenizer = {
  cut: (text) =>
    text.split(/[^\p{Script=Han}]+/u).filter(Boolean),
};

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

function capture() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    deps: {
      stdout: (chunk: string) => stdout.push(chunk),
      stderr: (chunk: string) => stderr.push(chunk),
      loadTokenizer: async () => tokenizer,
    },
  };
}

describe('CLI pipeline', () => {
  it('emits deterministic JSON and exit code 0', async () => {
    const { root } = await fixture();
    await writeUtf8(root, 'a.md', '写作、写作、时间。');
    const { stdout, stderr, deps } = capture();

    const code = await run([root, '--json'], deps);
    const result = JSON.parse(stdout.join(''));

    expect(code).toBe(0);
    expect(stderr.join('')).toBe('');
    expect(result).toEqual([
      {
        file: 'a.md',
        chineseCharacters: 6,
        topWords: [
          { word: '写作', count: 2 },
          { word: '时间', count: 1 },
        ],
      },
    ]);
  });

  it('emits the human table for successful files', async () => {
    const { root } = await fixture();
    await writeUtf8(root, 'a.md', '写作、写作、时间。');
    const { stdout, deps } = capture();

    const code = await run([root], deps);

    expect(code).toBe(0);
    expect(stdout.join('')).toContain('文件');
    expect(stdout.join('')).toContain('中文字数');
    expect(stdout.join('')).toContain('高频词（次数）');
    expect(stdout.join('')).toContain('写作(2)');
  });

  it('reports a code-only file with zero characters and no words', async () => {
    const { root } = await fixture();
    await writeUtf8(root, 'empty.md', '```js\n不应统计\n```\n');
    const { stdout, deps } = capture();

    const code = await run([root, '--json'], deps);

    expect(code).toBe(0);
    expect(JSON.parse(stdout.join(''))).toEqual([
      {
        file: 'empty.md',
        chineseCharacters: 0,
        topWords: [],
      },
    ]);
  });

  it('reports invalid UTF-8 and continues', async () => {
    const { root } = await fixture();
    await writeUtf8(root, 'good.md', '写作');
    await writeBytes(root, 'bad.md', new Uint8Array([0xff, 0xfe, 0xfd]));
    const { stdout, stderr, deps } = capture();

    const code = await run([root, '--json'], deps);

    expect(code).toBe(1);
    expect(JSON.parse(stdout.join(''))[0].file).toBe('good.md');
    expect(stderr.join('')).toContain('bad.md');
    expect(stderr.join('')).toContain('UTF-8');
  });

  it('keeps JSON valid when every file fails', async () => {
    const { root } = await fixture();
    await writeBytes(root, 'a.md', new Uint8Array([0xff]));
    await writeBytes(root, 'b.md', new Uint8Array([0xfe]));
    const { stdout, stderr, deps } = capture();

    const code = await run([root, '--json'], deps);

    expect(code).toBe(1);
    expect(stdout.join('')).toBe('[]\n');
    expect(stderr.join('').match(/UTF-8/g)).toHaveLength(2);
  });

  it('handles a directory without Markdown files', async () => {
    const { root } = await fixture();
    await writeUtf8(root, 'note.txt', '忽略');
    const { stdout, stderr, deps } = capture();

    const code = await run([root], deps);

    expect(code).toBe(0);
    expect(stdout.join('')).toBe('');
    expect(stderr.join('')).toContain('No Markdown files found');
  });

  it('emits [] for a directory without Markdown files in JSON mode', async () => {
    const { root } = await fixture();
    await writeUtf8(root, 'note.txt', '忽略');
    const { stdout, stderr, deps } = capture();

    const code = await run([root, '--json'], deps);

    expect(code).toBe(0);
    expect(stdout.join('')).toBe('[]\n');
    expect(stderr.join('')).toContain('No Markdown files found');
  });

  it('rejects an invalid root with exit code 2', async () => {
    const { root } = await fixture();
    const missing = join(root, 'missing');
    const { stdout, stderr, deps } = capture();

    const code = await run([missing], deps);

    expect(code).toBe(2);
    expect(stdout.join('')).toBe('');
    expect(stderr.join('')).toContain('Cannot access root');
  });

  it('rejects missing arguments and unknown options with usage', async () => {
    const noDirectory = capture();
    expect(await run([], noDirectory.deps)).toBe(2);
    expect(noDirectory.stdout.join('')).toBe('');
    expect(noDirectory.stderr.join('')).toContain('Usage: mdzh-stats');

    const unknown = capture();
    expect(await run(['--unknown'], unknown.deps)).toBe(2);
    expect(unknown.stdout.join('')).toBe('');
    expect(unknown.stderr.join('')).toContain('Usage: mdzh-stats');
  });
});

function runBinary(args: string[]): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['dist/cli.js', ...args], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('compiled binary', () => {
  it('loads the real jieba adapter and emits JSON', async () => {
    const { root } = await fixture();
    await writeUtf8(root, 'a.md', '写作、写作、时间。');
    const result = await runBinary([root, '--json']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)[0].topWords[0]).toEqual({
      word: '写作',
      count: 2,
    });
  }, 20_000);
});
