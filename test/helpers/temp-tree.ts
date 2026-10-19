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
