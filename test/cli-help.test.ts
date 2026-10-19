import { spawn } from 'node:child_process';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  it('runs when invoked through a directory junction or symlink', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'mdzh-stats-link-'));
    const linkedPackage = join(temp, 'linked-package');
    await symlink(
      process.cwd(),
      linkedPackage,
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    try {
      const result = await new Promise<{
        code: number | null;
        stdout: string;
        stderr: string;
      }>((resolve) => {
        const child = spawn(
          process.execPath,
          [join(linkedPackage, 'dist', 'cli.js'), '--help'],
          { stdio: ['ignore', 'pipe', 'pipe'] },
        );
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

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Usage: mdzh-stats <directory>');
      expect(result.stderr).toBe('');
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }, 20_000);
});
