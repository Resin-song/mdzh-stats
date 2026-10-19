#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { realpathSync, readFileSync as readPackageFile } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { analyzeProse, createJiebaTokenizer } from './analyze.js';
import { extractProse } from './extract.js';
import { renderJson, renderTable } from './report.js';
import { RootPathError, scanMarkdownFiles } from './scan.js';
import type { FileStatistics, ScanResult, Tokenizer } from './types.js';

export const USAGE =
  'Usage: mdzh-stats <file-or-directory> [--json]\n' +
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

function isDirectInvocation(): boolean {
  const invokedPath = process.argv[1];
  if (!invokedPath) {
    return false;
  }
  try {
    return (
      realpathSync(invokedPath) ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  process.exitCode = await run(process.argv.slice(2));
}
