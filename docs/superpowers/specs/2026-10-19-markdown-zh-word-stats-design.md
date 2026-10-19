# Markdown 中文字数与高频词统计 CLI 设计

**Date:** 2026-10-19
**Status:** Approved
**Approved:** 2026-10-19
**Decision Log:** `docs/superpowers/brainstorms/2026-10-19-markdown-zh-word-stats-brainstorm.md`

## Problem

Markdown 知识库中的源码包含标题标记、链接目标、front matter 和代码块。直接统计原始字符会把非正文内容混入结果；中文又没有天然空格，无法像英文一样按空白可靠切词。

用户需要一个可在个人知识库中运行的命令行工具，针对每个 Markdown 文件给出：

1. 自然语言正文中的中文字数；
2. 出现频率最高的 10 个中文词。

结果必须可比较、可重复，并同时支持人工阅读和脚本消费。

## Goals

- 接收一个目录，递归扫描其中的 `.md` 和 `.markdown` 文件。
- 从 Markdown 自然语言正文中统计汉字字符数。
- 使用中文分词识别词语，过滤停用词和单字词，给出每个文件的前 10 个高频词。
- 默认输出终端表格，通过 `--json` 输出稳定的机器可读结构。
- 对目录顺序、文件顺序、同频词顺序给出确定性规则。
- 对根路径错误、单文件失败和无匹配文件提供明确、可自动化的退出语义。

## Non-Goals

- 不生成所有文件的汇总词频。
- 不提供自定义停用词、分词词典、Top-N 或配置文件。
- 不分析英文词频、中文以外的语言或代码标识符。
- 不实现全文搜索、语义分析、摘要或写作质量评分。
- 不监听目录变化、不维护增量索引、不并行处理数万级文件。
- 不转换 GBK、GB18030 等非 UTF-8 文件。
- 不从原始 HTML 块或 HTML 标签中提取可见文字；Markdown 正文中的 raw HTML 被视为标记并排除。
- 不输出 HTML、Markdown 报表或图形化结果。

## Design Principles

1. **正文优先**：统计对象是读者看到的自然语言，而非 Markdown 源码或代码示例。
2. **确定性优先**：相同目录内容和版本必须生成相同顺序和相同结果，不依赖文件系统枚举顺序。
3. **文件级隔离**：单个文件的读取或解析失败不能破坏其他文件的结果。
4. **最小接口**：只提供一个必填目录参数、`--json`、`--help` 和 `--version`。
5. **自动化友好**：stdout 只输出结果数据，诊断信息写入 stderr，退出码表达成功、部分失败和调用错误。
6. **顺序处理**：面向数千文件的个人知识库，按文件顺序处理，避免并发和索引带来的复杂度。
7. **无副作用**：只读扫描输入目录，不执行 Markdown 中的 HTML、链接或代码。

## Acceptance Scenarios

```gherkin
Feature: Per-file Chinese text statistics for Markdown

  Scenario: Count prose while excluding non-prose Markdown content
    Given a root directory containing "article.md" with a YAML title, a level-one heading "写作", the paragraph "写作让人看见。", a fenced code block containing "写作", an HTML comment containing "不应统计", a link labelled "写作" whose destination contains "不应统计", and an image whose alt text is "时间"
    When the user runs "mdzh-stats <root>"
    Then the row for "article.md" reports 12 Chinese characters
    And "写作" is reported with frequency 3
    And the YAML value, fenced code text, HTML comment, link URL, and Markdown punctuation are not counted

  Scenario: Keep statistics isolated per file
    Given "a.md" contains "写作写作" and "b.md" contains "写作时间"
    When the user runs "mdzh-stats <root>"
    Then "a.md" reports "写作" with frequency 2
    And "b.md" reports "写作" and "时间" each with frequency 1
    And no cross-file aggregate row is printed

  Scenario: Emit deterministic JSON
    Given a root directory containing Markdown files whose relative paths are "z.md" and "a.md"
    When the user runs "mdzh-stats <root> --json"
    Then stdout is valid JSON
    And the result is a JSON array ordered by "a.md" then "z.md"
    And each item has "file", "chineseCharacters", and "topWords"
    And each "topWords" item has "word" and "count"

  Scenario: Break frequency ties deterministically
    Given one file contains "时间、看见。" and jieba produces the eligible words "时间" and "看见" once each
    When the user requests its top words
    Then "时间" appears before "看见" because its Unicode code point sequence is lower

  Scenario: Scan recursively with predictable inclusion rules
    Given a root directory contains "a.md", "B.MARKDOWN", a nested "sub/c.md", a hidden directory ".private/d.md", and a symlinked directory outside the root
    When the user runs the command
    Then "a.md", "B.MARKDOWN", and "sub/c.md" are analyzed
    And ".private/d.md" and files reachable only through the symlink are not analyzed
    And output paths use POSIX separators relative to the root

  Scenario: Reject an invalid root directory
    Given the supplied path does not exist or is not a directory
    When the user runs the command
    Then no result table or JSON array is written to stdout
    And an error is written to stderr
    And the process exits with code 2

  Scenario: Continue after one malformed file
    Given the root contains a valid UTF-8 "good.md" and an invalid UTF-8 "bad.md"
    When the user runs "mdzh-stats <root> --json"
    Then stdout contains a valid JSON array with the result for "good.md"
    And stderr identifies "bad.md" as a decoding failure
    And the process exits with code 1

  Scenario: Handle a directory with no Markdown files
    Given the root contains no ".md" or ".markdown" files
    When the user runs the command in table mode
    Then stdout is empty
    And stderr contains a concise no-Markdown-files notice
    And the process exits with code 0
    When the user runs the command with "--json"
    Then stdout is "[]"
    And the process exits with code 0

  Scenario: Render the default human-readable table
    Given the successful result set contains rows for "a.md" and "b.md"
    When the user runs the command without "--json"
    Then stdout contains the headers "文件", "中文字数", and "高频词（次数）"
    And each successful file appears in one table row
    And each populated word cell uses the form "词(count)"

  Scenario: Show an exact list shorter than ten terms
    Given a file contains "写作、时间、阅读。"
    When the user runs "mdzh-stats <root>"
    Then its top-words list contains exactly "写作", "时间", and "阅读", each with count 1
    And the command does not fail because ten terms are unavailable

  Scenario: Represent a file with no eligible content
    Given a Markdown file contains only a fenced code block and no prose
    When the user runs the command
    Then that file reports 0 Chinese characters
    And its JSON "topWords" value is an empty array
    And its table word cell is "—"

  Scenario: Keep JSON valid when every file fails
    Given the root contains two Markdown files and both fail strict UTF-8 decoding
    When the user runs "mdzh-stats <root> --json"
    Then stdout is "[]"
    And stderr contains two decoding warnings
    And the process exits with code 1

  Scenario: Preserve a machine-readable stdout channel
    Given a root contains one unreadable file and one valid file
    When the user runs the command with "--json"
    Then stdout remains parseable JSON for successful files
    And all warnings are emitted on stderr
```

## Design

### CLI Contract

The executable is `mdzh-stats`.

```text
mdzh-stats <directory> [--json]
mdzh-stats --help
mdzh-stats --version
```

Rules:

- `<directory>` is required unless `--help` or `--version` is present.
- Exactly one positional directory is accepted.
- `--json` swaps the default table renderer for JSON.
- `--help` prints usage and exits `0`; `--version` prints the package version and exits `0`.
- Unknown options, missing directory, or multiple positional arguments print usage to stderr and exit `2`.
- Short flags are not added in this version.

Exit codes:

| Code | Meaning |
|------|---------|
| `0` | All discovered files succeeded, or no Markdown files were discovered |
| `1` | At least one discovered file failed to read, decode, parse, or analyze; successful rows may still be emitted |
| `2` | Invalid invocation, invalid root directory, or failure to initialize a required runtime dependency |

Packaging contract:

- `src/cli.ts` begins with `#!/usr/bin/env node`.
- `tsc` emits the executable to `dist/cli.js`.
- `package.json` maps `"bin": {"mdzh-stats": "dist/cli.js"}`.
- The packed package includes `dist/`, `README.md`, and package metadata.

### Processing Pipeline

```text
parse CLI
  -> validate root
  -> discover Markdown files
  -> sort by normalized relative path
  -> for each file:
       read bytes
       strict UTF-8 decode
       parse Markdown to mdast
       extract prose text
       normalize text
       count Han characters
       segment Chinese words
       filter words
       rank top 10
  -> render table or JSON
  -> return exit code
```

The tool does not emit a progressive stream. It collects rows first so table alignment and JSON validity do not depend on traversal timing.

### Module Interfaces

The implementation uses these named contracts:

```ts
interface Diagnostic {
  path: string;
  message: string;
}

interface ScannedFile {
  absolutePath: string;
  displayPath: string;
}

interface ScanResult {
  files: ScannedFile[];
  diagnostics: Diagnostic[];
}

interface Tokenizer {
  cut(text: string): string[];
}

async function scanMarkdownFiles(root: string): Promise<ScanResult>;
function extractProse(markdown: string): string[];
function analyzeProse(
  file: string,
  prose: string,
  tokenizer: Tokenizer,
): FileStatistics;
function renderTable(rows: FileStatistics[]): string;
function renderJson(rows: FileStatistics[]): string;
```

Responsibilities and side effects:

- `scanMarkdownFiles` performs filesystem discovery and returns child-tree diagnostics; an invalid root throws a typed root error to the CLI.
- `extractProse` is pure.
- `analyzeProse` receives an initialized tokenizer adapter by dependency injection and does not perform file I/O. The adapter calls `@node-rs/jieba` in the selected precise mode and exposes the minimal `cut(text)` contract above.
- `renderTable` and `renderJson` are pure string builders.
- `cli.ts` is the only module that reads user arguments, writes stdout/stderr, and sets the exit code.

### Scanner

`src/scan.ts` owns file discovery.

- Input is an absolute or relative directory path.
- Validate the root with `stat`; only directories are accepted.
- Traverse recursively in depth-first order.
- Include regular files whose basename ends with `.md` or `.markdown`, case-insensitively.
- Skip directories whose basename starts with `.`.
- Skip any entry reported as a symbolic link by `Dirent`.
- Sort discovered entries with a Unicode code-point comparator on the POSIX-style relative path.
- Convert Windows separators to `/` before sorting and output.
- Return both an absolute file path for reading and a normalized display path.

The root itself may be a symbolic link to a directory; entries beneath it still follow the same skip rules. Discovery errors for a subtree are reported to stderr. A failure to read the root itself is a root error with exit code `2`; failures beneath the root mark the run as partially failed.

### Markdown Prose Extraction

`src/extract.ts` parses Markdown with:

- `unified`
- `remark-parse`
- `remark-gfm`
- `remark-frontmatter` for YAML front matter
- `unist-util-visit`

The extractor walks the mdast and returns an array of prose fragments in document order.

| Node or syntax | Behavior |
|----------------|----------|
| `text` | Include |
| `heading`, `paragraph`, `listItem`, `tableCell`, `emphasis`, `strong`, `delete` | Traverse children |
| `link`, `linkReference` | Traverse visible child text; never include the destination URL |
| `image`, `imageReference` | Include the `alt` string |
| `code`, `inlineCode` | Exclude |
| `yaml` / front matter | Exclude |
| `html` | Exclude the raw HTML node, which also removes HTML comments and tags |
| `break`, `thematicBreak`, `definition`, `footnoteDefinition` | Exclude |
| Autolink destination | Exclude destination; a URL-shaped visible label is removed by the URL filter |

After traversal, remove URL-shaped substrings matching `https?://`, `www.`, or an email address. This filter runs on prose fragments only, so Markdown link destinations never enter the pipeline.

Raw HTML blocks and HTML comments are parsed as `html` nodes and excluded in full. This tool analyzes Markdown prose, not prose embedded in raw HTML; extracting text from arbitrary HTML is an explicit non-goal.

Fragments are joined with newline separators before tokenization. The separator prevents adjacent Markdown blocks from being accidentally merged into one word.

### Chinese Counting, Tokenization, and Ranking

`src/analyze.ts` implements the text statistics.

Normalization:

1. Apply Unicode NFC normalization to the extracted prose.
2. Match Chinese characters with the Unicode Script property: `/\p{Script=Han}/gu`.
3. Count every matched character once per occurrence; punctuation, whitespace, Latin letters, digits, and symbols are excluded.

Word extraction:

1. Use `@node-rs/jieba` in precise mode.
2. Keep only tokens whose entire value matches `/^\p{Script=Han}{2,}$/u`.
3. Remove tokens found in the bundled stopword set.
4. Count remaining tokens independently for the current file.

Ranking:

1. Sort by frequency descending.
2. For equal frequencies, compare words by Unicode code-point sequence in ascending order.
3. Return at most 10 entries.

The frequency comparator does not use locale-sensitive collation, so results do not change with Windows locale or ICU data.

### Stopword Data

`src/stopwords.ts` exports a version-controlled `Set<string>` of common Chinese function words. The set contains only multi-character entries because the tokenizer already removes single-character words.

The initial data must cover at least these common words:

```text
我们 你们 他们 她们 它们 自己 什么 这样 那样 这里 那里 这个 那个
一个 一些 可以 没有 不是 就是 已经 还是 因为 所以 但是 如果 然后
以及 对于 关于 时候 这些 那些 这种 那种 而且 或者 虽然 不过
```

The file documents the provenance of the list in a source comment. Stopword data is source code, so `tsc` naturally includes it in the package; no separate asset-copy step is required. The list can be maintained without changing the CLI contract.

### Data Contract

The internal per-file result is:

```ts
interface WordFrequency {
  word: string;
  count: number;
}

interface FileStatistics {
  file: string;
  chineseCharacters: number;
  topWords: WordFrequency[];
}
```

Invariants:

- `file` is a non-empty POSIX-style path relative to the scan root.
- `chineseCharacters` is a non-negative integer.
- `topWords.length <= 10`.
- Every count is a positive integer.
- Top words are sorted by the ranking comparator.
- Results are sorted by `file` using the same Unicode code-point comparator as file discovery.

### Rendering

`src/report.ts` owns output rendering and never performs I/O itself.

Default table columns:

1. `文件`
2. `中文字数`
3. `高频词（次数）`

The top-words cell uses `词(count)、词(count)`; an empty list renders as `—`. The table is rendered with `cli-table3`, which accounts for East Asian display widths. A successful run with no discovered files prints nothing to stdout.

For table output only, C0/C1 control characters in a display path are replaced with visible `\uXXXX` escapes before rendering; newline and carriage return therefore cannot break row structure. JSON retains the original relative path and relies on JSON string escaping.

JSON output is a two-space-indented array, followed by one newline:

```json
[
  {
    "file": "notes/a.md",
    "chineseCharacters": 12,
    "topWords": [
      {
        "word": "写作",
        "count": 3
      }
    ]
  }
]
```

Diagnostics are never mixed into stdout. In JSON mode, `--json` output remains valid JSON even when some discovered files fail.

### Error Handling and Diagnostics

`src/cli.ts` validates invocation, coordinates the pipeline, writes diagnostics, and sets `process.exitCode`.

| Failure | Channel | Exit |
|---------|---------|------|
| Missing/multiple arguments, unknown option | stderr usage message | `2` |
| Root missing, not a directory, or not stat-able | stderr with the supplied path | `2` |
| Root directory cannot be read | stderr with the supplied path | `2` |
| Child directory cannot be read | stderr with relative path and reason; continue with siblings | `1` |
| Required dependency cannot initialize | stderr setup/error message | `2` |
| File read or strict UTF-8 decode failure | stderr with relative path and reason; continue | `1` |
| Markdown extraction or analysis throws for one file | stderr with relative path and reason; continue | `1` |
| No Markdown files discovered | concise stderr notice | `0` |
| One or more file failures | stderr warnings plus successful output | `1` |

Files are read as bytes and decoded with `new TextDecoder('utf-8', { fatal: true })`. A BOM is not counted as text.

A failure while reading a child directory is emitted once as a diagnostic, marks the run as partial, and traversal continues with other readable siblings. A failure to read the root directory itself is exit code `2`.

If every discovered file fails, table mode prints no stdout rows and JSON mode prints `[]`; diagnostics still go to stderr and the exit code is `1`.

The CLI parses arguments and validates the invocation before loading the native tokenizer. `@node-rs/jieba` is imported in a guarded initialization step; a load or initialization failure writes one setup diagnostic to stderr and exits `2` without emitting a partial result.

### Dependencies

Runtime:

- `@node-rs/jieba` — Chinese precise-mode segmentation.
- `unified`, `remark-parse`, `remark-gfm`, `remark-frontmatter`, `unist-util-visit` — Markdown AST and prose extraction.
- `cli-table3` — terminal table with East Asian width handling.

Development:

- `typescript`
- `@types/node`
- `@types/mdast`
- `vitest`

Node.js `>=20` is required. The current Node.js `24` environment satisfies it. `package-lock.json` pins the resolved dependency graph.

### Portability and Safety

- The tool performs no network requests.
- The tool does not execute HTML, scripts, links, or code fences.
- Symbolic links are not followed, preventing traversal outside the requested root.
- Relative display paths use `/` on Windows, macOS, and Linux.
- Output ordering is independent of filesystem enumeration and locale collation.
- Processing is sequential; peak retained file-content memory is one decoded file plus accumulated result rows.

## Implementation Phases

Each phase follows red-green-refactor. Do not start a later phase until the current phase's typecheck and tests pass.

### Phase 1: Project Skeleton and Dependency Preflight

1. Create the npm package, TypeScript configuration, build/typecheck/test scripts, `.gitignore`, bin mapping, and a shebang-bearing minimal CLI entry point that only parses `--help` and `--version`.
2. Install pinned dependencies and verify that `@node-rs/jieba` imports successfully on Windows with the current Node.js version.
3. Add a smoke test that invokes the package binary, checks help/version output, and verifies exit code `0`.
4. Run `npm run typecheck` and the test suite to establish a clean baseline.

### Phase 2: Deterministic Directory Scanner

1. Write failing tests for extension matching, recursive traversal, hidden-directory exclusion, symlink exclusion, POSIX path normalization, and deterministic sorting.
2. Implement `scanMarkdownFiles(root)` with root validation and ordered traversal.
3. Define and test the discovery-error result shape without mixing it with file analysis.
4. Re-run scanner tests and typecheck.

### Phase 3: Markdown Prose Extraction

1. Add fixture-driven tests for headings, paragraphs, lists, GFM tables, links, images, front matter, fenced code, inline code, HTML, URLs, and block-boundary separation.
2. Implement `extractProse(markdown)` using the configured remark pipeline.
3. Assert that link destinations and code content never reach the fragment list.
4. Add one regression test proving adjacent blocks do not merge into a single token.

### Phase 4: Chinese Count, Segmentation, and Ranking

1. Write tests for Han-only counting, repeated characters, NFC normalization, English/digit exclusion, minimum token length, pure-Han filtering, stopword removal, frequency aggregation, top-ten truncation, and deterministic tie-breaking.
2. Implement `normalizeText`, `countChineseCharacters`, `countWords`, and `rankTopWords`, with the tokenizer passed through the `Tokenizer` interface.
3. Add the provenance-documented stopword set.
4. Run the analysis tests and typecheck.

### Phase 5: Rendering and JSON Contract

1. Write exact-output tests for the table headers, empty top-word cell, and `词(count)` formatting.
2. Write JSON contract tests for field names, two-space indentation, determinism, and `[]` for no results.
3. Implement table and JSON renderers that return strings and perform no direct I/O.
4. Verify all diagnostic output remains outside the renderers.

### Phase 6: CLI Orchestration and Failure Semantics

1. Add integration tests for successful table/JSON runs, invalid root, unknown flags, partial UTF-8 failure, all-files-failed, no Markdown files, empty post-filter files, and fewer than ten words.
2. Implement the pipeline orchestration and exit-code mapping.
3. Verify that every warning goes to stderr and stdout remains valid in JSON mode.
4. Run the complete test suite and a production build.

### Phase 7: Packaging, Documentation, and Acceptance Verification

1. Add `README.md` with installation, usage examples, output schemas, exit codes, filtering rules, and limitations.
2. Run `npm pack --dry-run` and verify that only runtime files, documentation, and package metadata are included.
3. Execute every Gherkin scenario against a temporary fixture tree.
4. Run `npm run typecheck`, `npm test`, `npm run build`, and a final installed-binary smoke test.
5. Record the exact verification commands and outcomes in the implementation handoff.

## Testing Strategy

### Unit Tests

- Scanner: extensions, recursion, hidden directories, symlinks, path normalization, ordering.
- Extractor: syntax inclusion/exclusion matrix and fragment boundaries.
- Analyzer: Han matching, segmentation filter, stopwords, frequency, sorting, top-ten truncation.
- Reporter: table and JSON contracts.

### Integration Tests

Create temporary directory trees per test rather than depending on repository layout. Use a fixed Chinese fixture whose expected words can be asserted without asserting every jieba token. Focus assertions on:

- exact Chinese character counts;
- presence and frequency of known informative words;
- exclusion of known code/front-matter terms;
- output ordering;
- table escaping of control characters in display paths;
- exit codes and stdout/stderr separation.

Invalid UTF-8 is tested by writing an explicit byte buffer such as `[0xff, 0xfe, 0xfd]`. Symlink tests run only when the platform permits creating a directory symlink; otherwise they assert the scanner's `Dirent` behavior with a stub.

### Commands

```text
npm run typecheck
npm test
npm run build
node dist/cli.js --help
node dist/cli.js <fixture-root>
node dist/cli.js <fixture-root> --json
npm pack --dry-run
```

### Acceptance Gate

Implementation is not complete until:

- every Gherkin scenario has a passing automated test; if the host cannot create a directory symlink, that scenario may use a documented manual check while a unit test still verifies the `Dirent` skip logic;
- stdout/stderr behavior is verified for success and partial failure;
- a packed-install smoke test can execute `mdzh-stats`;
- no test depends on the host's locale or filesystem enumeration order.

## File Inventory

| Path | Purpose |
|------|---------|
| `package.json` | Package metadata, bin entry, runtime/dev dependencies, scripts |
| `package-lock.json` | Reproducible dependency resolution |
| `tsconfig.json` | Strict TypeScript configuration |
| `.gitignore` | Ignore build output, coverage, and local temp files |
| `README.md` | Usage, rules, output schema, errors, limitations |
| `src/types.ts` | `Diagnostic`, `ScannedFile`, `ScanResult`, `Tokenizer`, `WordFrequency`, and `FileStatistics` contracts |
| `src/stopwords.ts` | Version-controlled multi-character Chinese stopword set with provenance |
| `src/scan.ts` | Root validation, recursive discovery, symlink/hidden filters, path normalization, sorting |
| `src/extract.ts` | remark pipeline and mdast prose extraction |
| `src/analyze.ts` | NFC normalization, Han counting, jieba segmentation, filtering, ranking |
| `src/report.ts` | Table and JSON renderers |
| `src/cli.ts` | Argument parsing, pipeline orchestration, diagnostics, exit codes |
| `test/scan.test.ts` | Scanner unit tests |
| `test/extract.test.ts` | Markdown extraction tests |
| `test/analyze.test.ts` | Counting, tokenization, stopword, and ranking tests |
| `test/report.test.ts` | Table and JSON rendering tests |
| `test/cli.test.ts` | End-to-end CLI, error-channel, and exit-code tests |
| `test/helpers/temp-tree.ts` | Temporary fixture tree helpers and byte-file writer |

No library API is exported in version 0.1.0; the supported interface is the executable.

## Out of Scope

- Aggregate statistics across all files.
- Custom Top-N, custom stopword paths, dictionaries, globs, exclusions, or config files.
- Multiple input roots or direct file arguments.
- Parallel execution, worker threads, incremental cache, or watch mode.
- Conversion from non-UTF-8 encodings.
- Network access, telemetry, or remote dictionaries.
- HTML-rendered Markdown or browser/desktop UI.
- Publishing to a public npm registry as part of this implementation.
