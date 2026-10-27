import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { StartupOptions } from '../src/bootstrap/StartupOptions.js';

const rejected = [
  { args: ['--preserve-stlye'], unknown: '--preserve-stlye' },
  { args: ['--unknown'], unknown: '--unknown' },
  { args: ['--preserve-style', '--unknown'], unknown: '--unknown' },
  { args: ['--unknown', '--preserve-style'], unknown: '--unknown' },
  { args: ['drawing.svg'], unknown: 'drawing.svg' },
  { args: ['--preserve-style=true'], unknown: '--preserve-style=true' },
  { args: ['--plugin'], unknown: '--plugin' },
  { args: ['--'], unknown: '--' },
  { args: ['--bad\noption'], unknown: '--bad\noption' },
];

describe('startup options', () => {
  it.each([
    { args: [], preserve: false },
    { args: ['--preserve-style'], preserve: true },
    { args: ['--preserve-style', '--preserve-style'], preserve: true },
  ])('parses $args as preserve=$preserve', ({ args, preserve }) => {
    expect(new StartupOptions(args).preserveStyle).toBe(preserve);
  });
  it.each(rejected)('rejects the entire argument array $args', ({ args, unknown }) => {
    expect(() => new StartupOptions(args)).toThrow(new Error(`unknown option: ${unknown}`));
  });
  it('captures readonly configuration independently of the argument array', () => {
    const args = ['--preserve-style']; const options = new StartupOptions(args);
    args.length = 0; expect(options.preserveStyle).toBe(true);
  });
});

describe('real CLI startup at both entries', () => {
  const root = resolve('.');
  const directory = mkdtempSync(join(tmpdir(), 'svg-startup-tests-'));
  const built = join(directory, 'dist');
  beforeAll(() => {
    // Build from current source into a fresh temporary directory: never trust existing dist.
    writeFileSync(join(directory, 'package.json'), '{"type":"module"}\n');
    symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
    const result = spawnSync(join(root, 'node_modules/.bin/tsc'), ['-p', join(root, 'tsconfig.build.json'), '--outDir', built, '--sourceMap', 'false'], { cwd: root, encoding: 'utf8', timeout: 30000 });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(0);
  }, 35000);
  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  for (const entry of ['source', 'build']) {
    const run = (args: string[], input: string, cwd: string) => spawnSync(process.execPath,
      [...(entry === 'source' ? ['--import', join(root, 'node_modules/tsx/dist/loader.mjs'), join(root, 'src/bootstrap/Main.ts')] : [join(built, 'bootstrap/Main.js')]), ...args],
      { cwd, input, encoding: 'utf8', timeout: 15000 });

    it.each([
      { args: [], preserve: false },
      { args: ['--preserve-style'], preserve: true },
      { args: ['--preserve-style', '--preserve-style'], preserve: true },
    ])(`${entry}: normal commands and effective style mode for $args`, ({ args, preserve }) => {
      const result = run(args, ['init', 'create g outer', 'create g inner in outer', 'set inner fill red',
        'create rect r 1 2 3 4 in inner', 'ungroup inner', 'unknown', 'show r', ''].join('\n'), directory);
      expect(result.error).toBeUndefined(); expect(result.status).toBe(0); expect(result.stderr).toBe('');
      expect(result.stdout).toBe('canvas 800x600 created\ng#outer created\ng#inner created in g#outer\ng#inner updated: fill="red"\nrect#r created in g#inner\ng#inner ungrouped (1 children promoted)\nerror: unknown command: unknown\nrect#r  parent=g#outer\n  x=1 y=2 width=3 height=4\n' + (preserve ? '  fill=red\n' : ''));
    });
    it.each(rejected)(`${entry}: refuses $args without executing stdin`, ({ args, unknown }) => {
      const cwd = mkdtempSync(join(directory, 'rejected-'));
      const result = run(args, 'init\ncreate g should-not-exist\nsave should-not-exist.svg\n', cwd);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(2);
      expect(result.stderr).toBe(`error: unknown option: ${unknown.replace(/[\r\n]+/g, ' ')}\n`);
      expect(result.stdout).toBe('');
      expect(existsSync(join(cwd, 'should-not-exist.svg'))).toBe(false);
    });
  }
});
