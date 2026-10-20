import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ShapeFactory } from '../src/domain/factories/ShapeFactory.js';
import { SvgCodec } from '../src/infrastructure/svg/SvgCodec.js';
import { LocalTextStorage } from '../src/infrastructure/filesystem/LocalTextStorage.js';
import { TestEditor } from './TestEditor.js';
import { MemoryStorage } from './MemoryStorage.js';

const codec = new SvgCodec(new ShapeFactory());
const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">${body}</svg>`;

describe('SVG persistence', () => {
  it('round trips every shape, hierarchy, paint omission and escaped text', async () => {
    const storage = new MemoryStorage(); const e = new TestEditor(storage, codec);
    await e.setup('init 400 300','create g g','create rect r 1 2 3 4 in g','create circle c 1 2 3 red in g',
      'create ellipse e 1 2 3 4','create line l 1 2 3 4 black','create text t 3 4 "A & <B> 中文"');
    const before = await e.run('tree'); await e.setup('save out.svg');
    const content = await storage.read('out.svg');
    expect(content).toContain('&amp;'); expect(content).toContain('&lt;B&gt;');
    expect(content).toMatch(/<rect id="r" x="1" y="2" width="3" height="4"\s*\/>/);
    await e.setup('init','read out.svg'); expect(await e.run('tree')).toBe(before);
    expect(await e.run('undo')).toBe('error: undo not allowed after io command');
    await e.setup('move r 1 2','save'); expect(await storage.read('out.svg')).toContain('x="2"');
  });
  it('reserves every explicit id before auto assignment and warns deterministically', () => {
    const source = svg('<rect/><g><circle/></g><rect id="rect1"/>');
    const result = codec.decode(source);
    expect(result.warnings).toEqual([
      'warning: assigned id rect2 to unnamed <rect>', 'warning: assigned id g1 to unnamed <g>',
      'warning: assigned id circle1 to unnamed <circle>',
    ]);
    expect(result.document.size).toBe(4);
  });
  it.each([
    ['<svg><rect></svg>', 'malformed XML'],
    [svg('<g id="x"/><circle id="x"/>'), 'id already exists: x'],
    [svg('<path id="x"/>'), 'unknown shape type: path'],
    [svg('<g transform="rotate(30)"/>'), 'unsupported or invalid SVG transform'],
    [svg('<text><tspan>A</tspan></text>'), 'unsupported child element'],
    ['<!DOCTYPE svg><svg/>', 'DOCTYPE'],
    ['<svg width="20" height="20" viewBox="0 0 40 40"/>', 'viewBox'],
  ])('rejects unsupported or malformed input (%s)', (source, message) => {
    expect(() => codec.decode(source)).toThrow(message);
  });
  it('failed reads and saves preserve current document, path and redo history', async () => {
    const storage = new MemoryStorage(); const e = new TestEditor(storage, codec);
    await e.setup('init','create rect r 1 2 3 4','save original.svg','move r 10 20','undo');
    const before = await e.run('tree');
    storage.put('bad.svg', svg('<rect id="same"/><circle id="same"/>'));
    expect(await e.run('read bad.svg')).toBe('error: id already exists: same');
    expect(await e.run('read missing.svg')).toBe('error: cannot read file: missing.svg');
    expect(await e.run('tree')).toBe(before);
    await e.setup('redo'); expect(await e.run('show r')).toContain('x=11');
    storage.denyWrites(); expect(await e.run('save other.svg')).toBe('error: cannot write file: other.svg');
    expect(await e.run('save')).toBe('error: cannot write file: original.svg');
    await e.setup('undo'); expect(await e.run('tree')).toBe(before);
  });
  it('does not invent a save path for init', async () => {
    const e = new TestEditor(new MemoryStorage(), codec); await e.setup('init','create g g');
    expect(await e.run('save')).toBe('error: no file path. use save <file.svg>');
    await e.setup('undo'); expect(await e.run('tree')).not.toContain('g#g');
  });
  it('preserves root presentation, font options and unknown data-kind as plain g metadata', () => {
    const source = '<svg width="20" height="20" fill="red"><g id="box" data-kind="box"><text id="t" font-size="16" text-anchor="middle">End</text></g></svg>';
    const result = codec.decode(source); const saved = codec.encode(result.document);
    expect(saved).toContain('fill="red"'); expect(saved).toContain('data-kind="box"'); expect(saved).toContain('font-size="16"');
    expect(result.document.find('box').type).toBe('g');
  });
  it('atomically writes a real file and cleans temporary files on failure', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'svg-lab-'));
    try {
      const storage = new LocalTextStorage(); const path = join(directory, 'out.svg');
      await storage.write(path, 'first'); await storage.write(path, 'second');
      expect(await readFile(path, 'utf8')).toBe('second');
      await expect(storage.write(join(directory,'missing','out.svg'), 'x')).rejects.toThrow('cannot write file:');
      await expect(storage.read(join(directory,'missing.svg'))).rejects.toThrow('cannot read file:');
      expect(await readdir(directory)).toEqual(['out.svg']);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
