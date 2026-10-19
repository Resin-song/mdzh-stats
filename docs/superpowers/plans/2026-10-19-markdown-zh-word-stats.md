# Markdown 中文字数与高频词统计 CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-deepseek-v4:subagent-driven-development (recommended) or superpowers-deepseek-v4:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an npm-installable `mdzh-stats <directory>` CLI that reports each Markdown file's Chinese character count and top 10 eligible Chinese words in table or JSON form.

**Architecture:** A sequential pipeline validates a root, discovers Markdown files deterministically, extracts prose from the mdast, analyzes normalized Chinese text with a jieba adapter, ranks terms per file, and renders all rows after processing. Pure extraction, analysis, and rendering modules are separated from filesystem and process I/O.

**Tech Stack:** Node.js 20+, TypeScript ESM, `@node-rs/jieba`, `unified`/`remark`, `unist-util-visit`, `cli-table3`, Vitest, Node `parseArgs`.

**Spec:** `docs/superpowers/specs/2026-10-19-markdown-zh-word-stats-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Create | npm metadata, executable mapping, dependencies, scripts |
| `package-lock.json` | Create | Pin the resolved dependency graph |
| `tsconfig.json` | Create | Strict TypeScript build to `dist/` |
| `.gitignore` | Create | Ignore dependencies, build output, coverage, and logs |
| `README.md` | Create | Install, usage, rules, output schema, exit codes, limitations |
| `src/types.ts` | Create | Shared diagnostics, scan, tokenizer, and result contracts |
| `src/ordering.ts` | Create | Shared Unicode code-point comparator |
| `src/stopwords.ts` | Create | Built-in multi-character Chinese stopword set |
| `src/scan.ts` | Create | Root validation and deterministic Markdown discovery |
| `src/extract.ts` | Create | remark pipeline and mdast prose extraction |
| `src/analyze.ts` | Create | jieba adapter, NFC normalization, Han count, filtering, ranking |
| `src/report.ts` | Create | Human table and JSON renderers |
| `src/cli.ts` | Create | Argument parsing, pipeline orchestration, stdout/stderr, exit codes |
| `test/helpers/temp-tree.ts` | Create | Temporary fixture trees and UTF-8/byte writers |
| `test/cli-help.test.ts` | Create | Help/version smoke tests |
| `test/scan.test.ts` | Create | Scanner unit tests |
| `test/extract.test.ts` | Create | Markdown extraction tests |
| `test/analyze.test.ts` | Create | Counting, tokenization, stopword, and ranking tests |
| `test/report.test.ts` | Create | Table and JSON rendering tests |
| `test/cli.test.ts` | Create | Pipeline, exit-code, and compiled-binary tests |

---

## Chunk 1: Foundation and Input Discovery

### Task 1: Scaffold the package and help/version surface

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/cli.ts`
- Create: `test/cli-help.test.ts`

**Acceptance Criteria:**

Feature: CLI metadata commands
  Scenario: Show help without requiring a directory
    Given the compiled package is available
    When the user runs "mdzh-stats --help"
    Then stdout contains "Usage: mdzh-stats <directory> [--json]"
    And the process exits with code 0

  Scenario: Show the package version
    Given the compiled package is available
    When the user runs "mdzh-stats --version"
    Then stdout contains "0.1.0"
    And the process exits with code 0

- [ ] **Step 1: Create the build scaffold and a compilable CLI stub**

Create `package.json` with this content:

```json
{
  "name": "mdzh-stats",
  "version": "0.1.0",
  "description": "Count Chinese characters and top words in Markdown files",
  "type": "module",
  "bin": {
    "mdzh-stats": "dist/cli.js"
  },
  "files": [
    "dist/",
    "README.md"
  ],
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "clean": "node -e \"require('node:fs').rmSync('dist',{recursive:true,force:true})\"",
    "build": "npm run clean && tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "npm run build && vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@node-rs/jieba": "^1.10.0",
    "cli-table3": "^0.6.5",
    "remark-frontmatter": "^5.0.0",
    "remark-gfm": "^4.0.1",
    "remark-parse": "^11.0.0",
    "unified": "^11.0.5",
    "unist-util-visit": "^5.0.0"
  },
  "devDependencies": {
    "@types/cli-table3": "^0.6.5",
    "@types/mdast": "^4.0.4",
    "@types/node": "^24.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.2.0"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

Create `.gitignore`:

```text
node_modules/
dist/
coverage/
*.log
```

Create `src/cli.ts` as a compilable stub:

```ts
#!/usr/bin/env node

export const USAGE =
  'Usage: mdzh-stats <directory> [--json]\n' +
  '       mdzh-stats --help\n' +
  '       mdzh-stats --version\n';

export async function run(_argv: string[]): Promise<number> {
  return 2;
}
```

- [ ] **Step 2: Install dependencies and create the lockfile**

Run:

```powershell
npm install
```

Expected: `package-lock.json` is created and `@node-rs/jieba` installs without a compiler error.

- [ ] **Step 3: Write the failing help/version test**

Create `test/cli-help.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { run, USAGE } from '../dist/cli.js';

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    deps: {
      stdout: (chunk: string) => out.push(chunk),
      stderr: (chunk: string) => err.push(chunk),
    },
  };
}

describe('CLI metadata', () => {
  it('prints help to stdout and exits 0', async () => {
    const { out, err, deps } = capture();
    const code = await run(['--help'], deps as never);
    expect(code).toBe(0);
    expect(out.join('')).toBe(USAGE);
    expect(err.join('')).toBe('');
  });

  it('prints version to stdout and exits 0', async () => {
    const { out, err, deps } = capture();
    const code = await run(['--version'], deps as never);
    expect(code).toBe(0);
    expect(out.join('').trim()).toBe('0.1.0');
    expect(err.join('')).toBe('');
  });
});
```

- [ ] **Step 4: Run the test to confirm RED**

Run:

```powershell
npm test -- test/cli-help.test.ts
```

Expected: both tests fail because the stub returns `2` and writes nothing.

- [ ] **Step 5: Implement help, version, usage, and direct execution**

Replace `src/cli.ts` with:

```ts
#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const USAGE =
  'Usage: mdzh-stats <directory> [--json]\n' +
  '       mdzh-stats --help\n' +
  '       mdzh-stats --version\n';

interface MetadataDependencies {
  stdout: (chunk: string) => void;
  stderr: (chunk: string) => void;
}

interface ParsedArguments {
  values: {
    json: boolean;
    help: boolean;
    version: boolean;
  };
  positionals: string[];
}

const packageMetadata = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

export async function run(
  argv: string[],
  deps: MetadataDependencies = {
    stdout: (chunk) => process.stdout.write(chunk),
    stderr: (chunk) => process.stderr.write(chunk),
  },
): Promise<number> {
  let parsed: ParsedArguments;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
        version: { type: 'boolean', default: false },
      },
    }) as ParsedArguments;
  } catch {
    deps.stderr(USAGE);
    return 2;
  }

  if (parsed.values.help) {
    deps.stdout(USAGE);
    return 0;
  }
  if (parsed.values.version) {
    deps.stdout(`${packageMetadata.version}\n`);
    return 0;
  }

  deps.stderr(USAGE);
  return 2;
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  process.exitCode = await run(process.argv.slice(2));
}
```

- [ ] **Step 6: Run typecheck and the focused test to confirm GREEN**

Run:

```powershell
npm run typecheck
npm test -- test/cli-help.test.ts
```

Expected: typecheck passes; both metadata tests pass.

- [ ] **Step 7: Commit the scaffold**

```powershell
git add package.json package-lock.json tsconfig.json .gitignore src/cli.ts test/cli-help.test.ts
git commit -m "chore: scaffold mdzh-stats TypeScript CLI"
```

---

### Task 2: Add shared contracts and deterministic Markdown discovery

**Files:**
- Create: `src/types.ts`
- Create: `src/ordering.ts`
- Create: `src/scan.ts`
- Create: `test/helpers/temp-tree.ts`
- Create: `test/scan.test.ts`

**Acceptance Criteria:**

Feature: Deterministic Markdown discovery
  Scenario: Discover supported files recursively
    Given a root contains "a.md", "B.MARKDOWN", "sub/c.md", ".private/d.md", "note.txt", and a symlinked directory
    When the scanner runs
    Then it returns "a.md", "B.MARKDOWN", and "sub/c.md" in stable path order
    And it does not return hidden, unsupported, or symlink-only files

  Scenario: Reject an invalid root
    Given the root path is a regular file
    When the scanner runs
    Then it throws RootPathError before returning a scan result

- [ ] **Step 1: Add shared contracts**

Create `src/types.ts`:

```ts
export interface Diagnostic {
  path: string;
  message: string;
}

export interface ScannedFile {
  absolutePath: string;
  displayPath: string;
}

export interface ScanResult {
  files: ScannedFile[];
  diagnostics: Diagnostic[];
}

export interface Tokenizer {
  cut(text: string): string[];
}

export interface WordFrequency {
  word: string;
  count: number;
}

export interface FileStatistics {
  file: string;
  chineseCharacters: number;
  topWords: WordFrequency[];
}
```

Create `src/ordering.ts`:

```ts
export function compareCodePoints(left: string, right: string): number {
  const a = Array.from(left, (char) => char.codePointAt(0)!);
  const b = Array.from(right, (char) => char.codePointAt(0)!);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }
  return a.length - b.length;
}
```

- [ ] **Step 2: Add temporary-tree helpers**

Create `test/helpers/temp-tree.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export async function createTempTree(): Promise<{
  root: string;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(join(tmpdir(), 'mdzh-stats-'));
  return {
    root,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

export async function writeUtf8(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

export async function writeBytes(
  root: string,
  relativePath: string,
  content: Uint8Array,
): Promise<void> {
  const target = join(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}
```

- [ ] **Step 3: Write failing scanner tests**

Create `test/scan.test.ts`:

```ts
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

  it('throws RootPathError for a non-directory root', async () => {
    const { root } = await fixture();
    const file = join(root, 'file.md');
    await writeFile(file, '正文', 'utf8');

    await expect(scanMarkdownFiles(file)).rejects.toBeInstanceOf(RootPathError);
  });
});
```

- [ ] **Step 4: Run the scanner test to confirm RED**

Run:

```powershell
npm test -- test/scan.test.ts
```

Expected: build fails because `src/scan.ts` does not exist.

- [ ] **Step 5: Implement the scanner**

Create `src/scan.ts`:

```ts
import { readdir, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { compareCodePoints } from './ordering.js';
import type { Diagnostic, ScanResult, ScannedFile } from './types.js';

export class RootPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RootPathError';
  }
}

export function shouldEnterDirectory(
  name: string,
  isSymbolicLink: boolean,
): boolean {
  return !isSymbolicLink && !name.startsWith('.');
}

function isMarkdownFile(name: string): boolean {
  return /\.(md|markdown)$/i.test(name);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toDisplayPath(root: string, absolutePath: string): string {
  return relative(root, absolutePath).split(sep).join('/');
}

export async function scanMarkdownFiles(root: string): Promise<ScanResult> {
  const absoluteRoot = resolve(root);
  let rootStat;
  try {
    rootStat = await stat(absoluteRoot);
  } catch (error) {
    throw new RootPathError(`Cannot access root "${root}": ${errorMessage(error)}`);
  }
  if (!rootStat.isDirectory()) {
    throw new RootPathError(`Root is not a directory: ${root}`);
  }

  const files: ScannedFile[] = [];
  const diagnostics: Diagnostic[] = [];

  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (directory === absoluteRoot) {
        throw new RootPathError(
          `Cannot read root "${root}": ${errorMessage(error)}`,
        );
      }
      diagnostics.push({
        path: toDisplayPath(absoluteRoot, directory),
        message: `Cannot read directory: ${errorMessage(error)}`,
      });
      return;
    }

    entries.sort((a, b) => compareCodePoints(a.name, b.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (shouldEnterDirectory(entry.name, false)) {
          await walk(absolutePath);
        }
        continue;
      }
      if (entry.isFile() && isMarkdownFile(entry.name)) {
        files.push({
          absolutePath,
          displayPath: toDisplayPath(absoluteRoot, absolutePath),
        });
      }
    }
  }

  await walk(absoluteRoot);
  files.sort((a, b) => compareCodePoints(a.displayPath, b.displayPath));
  return { files, diagnostics };
}
```

- [ ] **Step 6: Run scanner tests and typecheck to confirm GREEN**

Run:

```powershell
npm run typecheck
npm test -- test/scan.test.ts
```

Expected: four scanner tests pass.

- [ ] **Step 7: Commit the scanner**

```powershell
git add src/types.ts src/ordering.ts src/scan.ts test/helpers/temp-tree.ts test/scan.test.ts
git commit -m "feat(scan): discover Markdown files deterministically"
```

---

## Chunk 2: Parsing and Analysis

### Task 3: Extract prose from Markdown

**Files:**
- Create: `src/extract.ts`
- Create: `test/extract.test.ts`

**Acceptance Criteria:**

Feature: Markdown prose extraction
  Scenario: Keep visible prose and exclude non-prose nodes
    Given Markdown contains a heading, paragraph, link text, image alt text, front matter, fenced code, inline code, HTML, comments, and a URL
    When prose is extracted
    Then heading, paragraph, link text, and image alt text are returned in document order
    And front matter, code, raw HTML, comments, and URL content are absent

- [ ] **Step 1: Write the failing extraction test**

Create `test/extract.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to confirm RED**

Run:

```powershell
npm test -- test/extract.test.ts
```

Expected: build fails because `src/extract.ts` does not exist.

- [ ] **Step 3: Implement prose extraction**

Create `src/extract.ts`:

```ts
import type { Image, ImageReference, Root, Text } from 'mdast';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<>()]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/giu;

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ['yaml']);

function stripUrls(text: string): string {
  return text.replace(URL_PATTERN, ' ').replace(/\s+/gu, ' ').trim();
}

export function extractProse(markdown: string): string[] {
  const tree = processor.parse(markdown) as Root;
  const fragments: string[] = [];

  visit(tree, (node) => {
    if (node.type === 'text') {
      fragments.push(stripUrls((node as Text).value));
      return;
    }
    if (node.type === 'image' || node.type === 'imageReference') {
      const alt = (node as Image | ImageReference).alt;
      if (alt) {
        fragments.push(stripUrls(alt));
      }
    }
  });

  return fragments.filter((fragment) => fragment.length > 0);
}
```

- [ ] **Step 4: Run extraction tests and typecheck to confirm GREEN**

Run:

```powershell
npm run typecheck
npm test -- test/extract.test.ts
```

Expected: both extraction tests pass.

- [ ] **Step 5: Commit the extractor**

```powershell
git add src/extract.ts test/extract.test.ts
git commit -m "feat(markdown): extract natural-language prose"
```

---

### Task 4: Count Han characters, tokenize Chinese, filter, and rank

**Files:**
- Create: `src/stopwords.ts`
- Create: `src/analyze.ts`
- Create: `test/analyze.test.ts`

**Acceptance Criteria:**

Feature: Per-file Chinese word statistics
  Scenario: Count only Han characters and retain informative words
    Given normalized prose contains Han characters, Latin letters, digits, and punctuation
    When a file is analyzed with a tokenizer returning "我们", "写作", "A1", "时间", and "看"
    Then the Han count includes only Han characters
    And "我们" is removed as a stopword
    And "写作" and "时间" remain because they are multi-character pure-Han tokens
    And "A1" and "看" are excluded

  Scenario: Rank equal frequencies by Unicode code point
    Given "时间" and "看见" each have count 1
    When top words are ranked
    Then "时间" appears before "看见"

- [ ] **Step 1: Add the stopword data**

Create `src/stopwords.ts`:

```ts
// Curated in-repo list of common multi-character Chinese function words.
// Single-character words are already excluded by the analyzer's length filter.
export const STOPWORDS = new Set<string>([
  '我们', '你们', '他们', '她们', '它们', '自己', '什么', '这样', '那样',
  '这里', '那里', '这个', '那个', '一个', '一些', '可以', '没有', '不是',
  '就是', '已经', '还是', '因为', '所以', '但是', '如果', '然后', '以及',
  '对于', '关于', '时候', '这些', '那些', '这种', '那种', '而且', '或者',
  '虽然', '不过',
]);
```

- [ ] **Step 2: Write failing analyzer tests**

Create `test/analyze.test.ts`:

```ts
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
    expect(analyzeProse('a.md', '写作 A1。', fakeTokenizer)).toEqual({
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
```

- [ ] **Step 3: Run the analyzer tests to confirm RED**

Run:

```powershell
npm test -- test/analyze.test.ts
```

Expected: build fails because `src/analyze.ts` does not exist.

- [ ] **Step 4: Implement analysis and the jieba adapter**

Create `src/analyze.ts`:

```ts
import { STOPWORDS } from './stopwords.js';
import { compareCodePoints } from './ordering.js';
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
```

- [ ] **Step 5: Run analyzer tests and typecheck to confirm GREEN**

Run:

```powershell
npm run typecheck
npm test -- test/analyze.test.ts
```

Expected: all analyzer tests pass, including the real jieba adapter test.

- [ ] **Step 6: Commit analysis**

```powershell
git add src/stopwords.ts src/analyze.ts test/analyze.test.ts
git commit -m "feat(analyze): count Han characters and rank Chinese words"
```

---

## Chunk 3: Rendering and CLI Integration

### Task 5: Render stable table and JSON output

**Files:**
- Create: `src/report.ts`
- Create: `test/report.test.ts`

**Acceptance Criteria:**

Feature: Result rendering
  Scenario: Render a human-readable table
    Given a result row for "a.md" with 2 Chinese characters and one word "写作"
    When the table renderer runs
    Then the output contains "文件", "中文字数", and "高频词（次数）"
    And the output contains "a.md" and "写作(1)"

  Scenario: Render stable JSON
    Given two result rows
    When the JSON renderer runs
    Then the output parses to the original rows
    And the text ends with one newline

- [ ] **Step 1: Write failing renderer tests**

Create `test/report.test.ts`:

```ts
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
```

- [ ] **Step 2: Run renderer tests to confirm RED**

Run:

```powershell
npm test -- test/report.test.ts
```

Expected: build fails because `src/report.ts` does not exist.

- [ ] **Step 3: Implement renderers**

Create `src/report.ts`:

```ts
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
```

- [ ] **Step 4: Run renderer tests and typecheck to confirm GREEN**

Run:

```powershell
npm run typecheck
npm test -- test/report.test.ts
```

Expected: all renderer tests pass.

- [ ] **Step 5: Commit renderers**

```powershell
git add src/report.ts test/report.test.ts
git commit -m "feat(report): render Markdown statistics as table or JSON"
```

---

### Task 6: Orchestrate the CLI pipeline and error semantics

**Files:**
- Modify: `src/cli.ts`
- Create: `test/cli.test.ts`

**Acceptance Criteria:**

Feature: CLI analysis pipeline
  Scenario: Analyze valid files
    Given a root contains "a.md" with "写作、写作、时间。"
    When the CLI runs in JSON mode
    Then the JSON contains one item for "a.md" with 6 Chinese characters
    And "写作" has count 2
    And the process exits with code 0

  Scenario: Continue after malformed UTF-8
    Given one file is valid UTF-8 and one file contains invalid bytes
    When the CLI runs
    Then valid results are emitted
    And the invalid file is reported on stderr
    And the process exits with code 1

  Scenario: Reject invalid invocation and root
    Given no directory or a nonexistent directory
    When the CLI runs
    Then stdout is empty
    And stderr contains usage or root error text
    And the process exits with code 2

- [ ] **Step 1: Write failing CLI pipeline tests**

Create `test/cli.test.ts`:

```ts
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
```

- [ ] **Step 2: Run CLI tests to confirm RED**

Run:

```powershell
npm test -- test/cli.test.ts
```

Expected: pipeline tests fail because the current CLI only handles metadata and returns `2`; the compiled-binary test also fails.

- [ ] **Step 3: Replace the CLI with full orchestration**

Replace `src/cli.ts` with:

```ts
#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { readFileSync as readPackageFile } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createJiebaTokenizer, analyzeProse } from './analyze.js';
import { extractProse } from './extract.js';
import { renderJson, renderTable } from './report.js';
import { RootPathError, scanMarkdownFiles } from './scan.js';
import type { FileStatistics, ScanResult, Tokenizer } from './types.js';

export const USAGE =
  'Usage: mdzh-stats <directory> [--json]\n' +
  '       mdzh-stats --help\n' +
  '       mdzh-stats --version\n';

export interface CliDependencies {
  stdout: (chunk: string) => void;
  stderr: (chunk: string) => void;
  loadTokenizer: () => Promise<Tokenizer>;
}

interface ParsedArguments {
  values: {
    json: boolean;
    help: boolean;
    version: boolean;
  };
  positionals: string[];
}

const packageMetadata = JSON.parse(
  readPackageFile(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Invalid UTF-8 input');
  }
}

export async function run(
  argv: string[],
  deps: CliDependencies = {
    stdout: (chunk) => process.stdout.write(chunk),
    stderr: (chunk) => process.stderr.write(chunk),
    loadTokenizer: createJiebaTokenizer,
  },
): Promise<number> {
  let parsed: ParsedArguments;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
        version: { type: 'boolean', default: false },
      },
    }) as ParsedArguments;
  } catch {
    deps.stderr(USAGE);
    return 2;
  }

  if (parsed.values.help) {
    deps.stdout(USAGE);
    return 0;
  }
  if (parsed.values.version) {
    deps.stdout(`${packageMetadata.version}\n`);
    return 0;
  }
  if (parsed.positionals.length !== 1) {
    deps.stderr(USAGE);
    return 2;
  }

  const root = parsed.positionals[0];
  let scan: ScanResult;
  try {
    scan = await scanMarkdownFiles(root);
  } catch (error) {
    const message =
      error instanceof RootPathError
        ? error.message
        : `Cannot scan root: ${errorMessage(error)}`;
    deps.stderr(`${message}\n`);
    return 2;
  }

  for (const diagnostic of scan.diagnostics) {
    deps.stderr(`${diagnostic.path}: ${diagnostic.message}\n`);
  }

  if (scan.files.length === 0) {
    if (parsed.values.json) {
      deps.stdout('[]\n');
    }
    deps.stderr('No Markdown files found.\n');
    return scan.diagnostics.length > 0 ? 1 : 0;
  }

  let tokenizer: Tokenizer;
  try {
    tokenizer = await deps.loadTokenizer();
  } catch (error) {
    deps.stderr(`Failed to initialize tokenizer: ${errorMessage(error)}\n`);
    return 2;
  }

  let hadFailure = scan.diagnostics.length > 0;
  const rows: FileStatistics[] = [];
  for (const file of scan.files) {
    try {
      const bytes = await readFile(file.absolutePath);
      const markdown = decodeUtf8(bytes);
      const prose = extractProse(markdown).join('\n');
      rows.push(analyzeProse(file.displayPath, prose, tokenizer));
    } catch (error) {
      hadFailure = true;
      deps.stderr(`${file.displayPath}: ${errorMessage(error)}\n`);
    }
  }

  const output = parsed.values.json
    ? renderJson(rows)
    : rows.length > 0
      ? renderTable(rows)
      : '';
  if (output) {
    deps.stdout(output);
  }
  return hadFailure ? 1 : 0;
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  process.exitCode = await run(process.argv.slice(2));
}
```

- [ ] **Step 4: Run the full suite to confirm GREEN**

Run:

```powershell
npm run typecheck
npm test
```

Expected: all tests pass, including the compiled binary with real jieba.

- [ ] **Step 5: Commit CLI orchestration**

```powershell
git add src/cli.ts test/cli.test.ts
git commit -m "feat(cli): analyze Markdown directories with exit semantics"
```

---

## Chunk 4: Packaging and Acceptance

### Task 7: Document, pack, and execute acceptance verification

**Files:**
- Create: `README.md`

**Acceptance Criteria:**

Feature: Installable release artifact
  Scenario: Inspect and execute the packed package
    Given all tests and typechecks pass
    When the package is packed to a temporary directory and installed into a temporary prefix
    Then the package contains "dist/cli.js", "README.md", and "package.json"
    And the installed "mdzh-stats" executable prints the usage header
    And "npm run typecheck", "npm test", and "npm run build" exit with code 0

- [ ] **Step 1: Write README usage and behavioral contract**

Create `README.md`:

````markdown
# mdzh-stats

Count Chinese characters and the top 10 informative Chinese words in every
Markdown file under a directory.

## Requirements

- Node.js 20 or newer

## Install

```powershell
npm install
npm run build
npm link
```

## Usage

```powershell
mdzh-stats <directory>
mdzh-stats <directory> --json
mdzh-stats --help
mdzh-stats --version
```

The default output is a human-readable terminal table. `--json` emits a
two-space-indented array for scripts.

## Statistics

- Scans `.md` and `.markdown` recursively, case-insensitively.
- Skips hidden directories and symbolic links.
- Counts only Han characters in natural-language Markdown prose.
- Excludes front matter, code blocks, inline code, raw HTML, HTML comments,
  URL targets, and Markdown syntax.
- Uses jieba precise segmentation, removes single-character tokens, and filters
  a built-in multi-character Chinese stopword set.
- Returns at most 10 words per file, ordered by count descending and Unicode
  code point ascending for ties.

## JSON schema

```json
[
  {
    "file": "notes/a.md",
    "chineseCharacters": 12,
    "topWords": [
      { "word": "写作", "count": 3 }
    ]
  }
]
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success, including a directory with no Markdown files |
| 1 | At least one file or child directory failed |
| 2 | Invalid invocation, invalid root, or tokenizer initialization failure |

## Limitations

- UTF-8 only.
- No aggregate statistics, custom dictionaries, custom stopwords, or Top-N.
- Raw HTML prose is not extracted.
````

- [ ] **Step 2: Run the complete automated verification**

Run:

```powershell
npm run typecheck
npm test
npm run build
```

Expected: all commands exit `0`; Vitest reports zero failures; `dist/cli.js` exists.

- [ ] **Step 3: Execute an end-to-end fixture with the compiled CLI**

Run:

```powershell
$fixture = Join-Path $env:TEMP "mdzh-stats-acceptance"
New-Item -ItemType Directory -Force -Path $fixture | Out-Null
Set-Content -LiteralPath (Join-Path $fixture "a.md") -Value ([string]::Join([Environment]::NewLine, @("# 写作", "", "写作让人看见。", "", "~~~js", "不应统计", "~~~"))) -Encoding utf8
node dist/cli.js $fixture
node dist/cli.js $fixture --json
```

Expected: the table contains `a.md` and `写作(2)`; JSON is valid, reports 6 Chinese characters, and contains no `不应统计`.

Remove the fixture afterward:

```powershell
Remove-Item -LiteralPath $fixture -Recurse -Force
```

- [ ] **Step 4: Inspect the packed package**

Run:

```powershell
npm pack --dry-run --json
```

Expected: the JSON file list contains `dist/cli.js`, `README.md`, and `package.json`; it does not contain `src/` or `test/`.

- [ ] **Step 5: Install the packed artifact into a temporary prefix**

Run:

```powershell
$packDir = Join-Path $env:TEMP ("mdzh-stats-pack-" + [guid]::NewGuid().ToString("N"))
$installDir = Join-Path $env:TEMP ("mdzh-stats-install-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $packDir | Out-Null
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
npm pack --pack-destination $packDir
$tgz = (Get-ChildItem -LiteralPath $packDir -Filter "*.tgz" | Select-Object -First 1).FullName
npm install --prefix $installDir $tgz
& (Join-Path $installDir "node_modules\.bin\mdzh-stats.cmd") --help
```

Expected: the installed executable prints `Usage: mdzh-stats <directory> [--json]`.

If the same PowerShell session still has `$packDir` and `$installDir`, remove the temporary pack/install directories:

```powershell
Remove-Item -LiteralPath $packDir -Recurse -Force
Remove-Item -LiteralPath $installDir -Recurse -Force
```

- [ ] **Step 6: Verify every spec acceptance scenario and commit**

Run the focused suite:

```powershell
npm test -- test/cli-help.test.ts test/scan.test.ts test/extract.test.ts test/analyze.test.ts test/report.test.ts test/cli.test.ts
git status --short
```

Expected: all scenario-bearing tests pass; `git status` shows only `README.md` before staging.

Commit:

```powershell
git add README.md
git commit -m "docs: document mdzh-stats usage and release contract"
```

---

## Final Verification Checklist

- [ ] `npm run typecheck` exits `0`.
- [ ] `npm test` exits `0` with all tests passing.
- [ ] `npm run build` emits `dist/cli.js` with a shebang.
- [ ] The compiled CLI produces the required table and JSON for a temporary fixture.
- [ ] Invalid root exits `2`; malformed UTF-8 exits `1`; no Markdown files exits `0`.
- [ ] `npm pack --dry-run --json` includes only runtime files and documentation.
- [ ] The packed artifact installs and its `mdzh-stats` binary prints usage.
- [ ] `git status --short` is clean after the final task commit.
