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
