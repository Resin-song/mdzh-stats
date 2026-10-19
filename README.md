# mdzh-stats

Count Chinese characters and the top 10 informative Chinese words in one
Markdown file or every Markdown file under a directory.

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
mdzh-stats <file-or-directory>
mdzh-stats <file-or-directory> --json
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
