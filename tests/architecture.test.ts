import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';

const source = resolve('src');
const files: string[] = [];
const collect = (directory: string): void => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path); else if (path.endsWith('.ts')) files.push(path);
  }
};
collect(source);
const edges = new Map<string, string[]>();
const allowed: Record<string, string[]> = {
  domain: ['domain'], application: ['application','domain'],
  cli: ['cli','application'], infrastructure: ['infrastructure','application','domain'],
  bootstrap: ['bootstrap','cli','application','domain','infrastructure'],
};

describe('documented architecture constraints', () => {
  it('respects module directions, external dependency isolation and file naming', () => {
    for (const file of files) {
      const module = relative(source, file).split('/')[0]!;
      const text = readFileSync(file, 'utf8');
      const targets: string[] = [];
      for (const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const imported = match[1]!;
        if (imported.startsWith('.')) {
          const target = resolve(dirname(file), imported.replace(/\.js$/, '.ts'));
          expect(files, `${file} -> ${imported}`).toContain(target);
          const targetModule = relative(source, target).split('/')[0]!;
          expect(allowed[module], `${file} -> ${targetModule}`).toContain(targetModule); targets.push(target);
        } else if (module === 'domain' || module === 'application') {
          throw new Error(`external dependency in ${module}: ${imported}`);
        }
      }
      edges.set(file, targets);
      const classes = [...text.matchAll(/export (?:abstract )?class (\w+)/g)].map(match => match[1]);
      expect(classes.length, file).toBeLessThanOrEqual(1);
      if (classes.length) expect(file.endsWith(`/${classes[0]}.ts`), file).toBe(true);
      expect(text, file).not.toMatch(/\bswitch\s*\(/);
    }
  });
  it('has no import cycles, including type dependencies', () => {
    const visited = new Set<string>(); const active = new Set<string>();
    const visit = (file: string): void => {
      if (active.has(file)) throw new Error(`circular dependency: ${file}`);
      if (visited.has(file)) return;
      active.add(file);
      for (const target of edges.get(file) ?? []) visit(target);
      active.delete(file); visited.add(file);
    };
    for (const file of files) visit(file);
  });
});
