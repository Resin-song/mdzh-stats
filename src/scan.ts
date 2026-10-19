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
