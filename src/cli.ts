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
