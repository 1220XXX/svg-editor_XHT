import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SvgCodec } from '../src/infrastructure/svg/SvgCodec.js';
import { ShapeFactory } from '../src/domain/factories/ShapeFactory.js';
import { PreserveBasicStyles } from '../src/domain/styles/PreserveBasicStyles.js';
import { TestEditor } from './TestEditor.js';
import { MemoryStorage } from './MemoryStorage.js';

const codec = new SvgCodec(new ShapeFactory());
const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" id="drawing" width="200" height="100">${body}</svg>`;
const preserving = (storage?: MemoryStorage) => new TestEditor(storage, storage ? codec : undefined, new PreserveBasicStyles());

describe('optional basic style preservation', () => {
  it.each([false, true])('keeps default behavior separate from the enhancement (preserve=%s)', async preserve => {
    const e = preserve ? preserving() : new TestEditor();
    await e.setup('init', 'create g outer', 'create g inner in outer', 'set inner fill red', 'create rect r 1 2 3 4 in inner', 'ungroup inner');
    expect((await e.run('show r')).includes('fill=red')).toBe(preserve);
  });
  it('preserves all three basic properties and explicit child paint when ungrouping', async () => {
    const e = preserving();
    await e.setup('init','create g outer','create g inner in outer','set inner fill red','set inner stroke green',
      'set inner stroke-width 3','create rect a 1 2 3 4 in inner','create circle b 5 6 7 blue in inner');
    const before = await e.run('tree'); await e.setup('ungroup inner');
    expect(await e.run('show a')).toBe('rect#a  parent=g#outer\n  x=1 y=2 width=3 height=4\n  fill=red\n  stroke=green\n  stroke-width=3');
    expect(await e.run('show b')).toContain('fill=blue'); expect(await e.run('show b')).toContain('stroke-width=3');
    const after = await e.run('tree');
    await e.setup('undo'); expect(await e.run('tree')).toBe(before);
    expect(await e.run('show a')).not.toContain('fill=');
    await e.setup('redo'); expect(await e.run('tree')).toBe(after);
  });
  it('preserves omitted defaults when moving into a styled parent', async () => {
    const e = preserving();
    await e.setup('init','create rect r 1 2 3 4','create g target','set target fill blue','set target stroke red','set target stroke-width 8');
    const before = await e.run('show r'); expect(before).not.toContain('fill=');
    await e.setup('addto target r');
    expect(await e.run('show r')).toContain('fill=black\n  stroke=none\n  stroke-width=1');
    await e.setup('undo'); expect(await e.run('show r')).toBe(before);
  });
  it('avoids unnecessary attributes when effective values match', async () => {
    const e = preserving();
    await e.setup('init','create g p','set p fill red','create g q','set q fill red','create rect r 1 2 3 4 in p','addto q r');
    expect(await e.run('show r')).not.toContain('fill=');
    await e.setup('create circle c 1 2 3 in q','group pair r c');
    expect(await e.run('show r')).not.toContain('fill='); expect(await e.run('show pair')).not.toContain('fill=');
  });
  it('groups across parents in original order and freezes each member independently', async () => {
    const e = preserving();
    await e.setup('init','create g p','set p fill red','create g q','set q fill blue',
      'create rect a 1 2 3 4 in p','create circle b 5 6 7 in q');
    const before = await e.run('tree'); await e.setup('group pair b a');
    expect(await e.run('show a')).toContain('fill=red'); expect(await e.run('show b')).toContain('fill=blue');
    const after = await e.run('tree'); expect(after.indexOf('rect#a')).toBeLessThan(after.indexOf('circle#b'));
    await e.setup('undo'); expect(await e.run('tree')).toBe(before);
    await e.setup('redo'); expect(await e.run('tree')).toBe(after);
  });
  it('preserves nested inheritance by patching the moved subtree root', async () => {
    const e = preserving();
    await e.setup('init','create g p','set p fill red','create g q','set q fill blue','create g branch in p',
      'create g inner in branch','create rect a 1 2 3 4 in inner','create text label 1 2 "A" in inner','set label fill yellow','addto q branch');
    expect(await e.run('show branch')).toContain('fill=red');
    expect(await e.run('show a')).not.toContain('fill=');
    expect(await e.run('show label')).toContain('fill=yellow');
    expect(await e.run('show a')).toContain('x=1 y=2 width=3 height=4');
  });
  it.each([
    ['inherit','red'], ['unset','red'], ['initial','initial'], ['#AbC','#AbC'], ['none','none'], ['RebeccaPurple','RebeccaPurple'],
  ])('handles explicit paint and inheritance keywords: %s', async (paint, expected) => {
    const e = preserving();
    await e.setup('init','create g p','set p fill red','create g q','set q fill blue',
      'create rect r 1 2 3 4 in p',`set r fill ${paint}`,'addto q r');
    expect(await e.run('show r')).toContain(`fill=${expected}`);
  });
  it('can override an unknown new paint with the known previous paint', async () => {
    const e = preserving();
    await e.setup('init','create g target','set target fill currentColor','create rect r 1 2 3 4 red','addto target r');
    expect(await e.run('show r')).toContain('fill=red');
  });
  it.each(['currentColor', 'url(#paint)', 'var(--color)', 'rgb(1,2,3)', 'notacolor'])('rejects unresolved previous paint without consuming redo (%s)', async paint => {
    const e = preserving();
    await e.setup('init','create g target',`create rect r 1 2 3 4 ${paint}`,'move r 10 0','undo');
    const before = await e.run('tree');
    expect(await e.run('addto target r')).toBe('error: cannot preserve style: unsupported fill paint on rect#r');
    expect(await e.run('tree')).toBe(before);
    await e.setup('redo'); expect(await e.run('show r')).toContain('x=11');
  });
  it.each([
    ['font-size','20'], ['font-family','monospace'], ['font-weight','bold'], ['text-anchor','middle'],
    ['fill-opacity','.5'], ['stroke-opacity','.5'],
  ])('rejects changes to inherited %s in the basic-only mode', async (attribute, value) => {
    const storage = new MemoryStorage();
    storage.put('source.svg',svg(`<g id="p" ${attribute}="${value}"><rect id="r" width="1" height="1"/></g><g id="q"/>`));
    const e = preserving(storage); await e.setup('read source.svg'); const before = await e.run('tree');
    expect(await e.run('addto q r')).toBe(`error: cannot preserve style: inherited ${attribute} would change on rect#r`);
    expect(await e.run('tree')).toBe(before);
  });
  it('allows unchanged extended styles and preserves root id through SVG round trips', async () => {
    const storage = new MemoryStorage();
    storage.put('source.svg',svg('<g id="p" fill="red" font-size="20"><rect id="r" width="1" height="1"/></g><g id="q" font-size="20"/>'));
    const e = preserving(storage); await e.setup('read source.svg','addto q r','save out.svg');
    const document = codec.decode(await storage.read('out.svg')).document;
    expect(document.rootId).toBe('drawing'); expect(document.find('r').attributes.fill).toBe('red');
    const before = await e.run('tree'); await e.setup('read out.svg'); expect(await e.run('tree')).toBe(before);
  });
  it('does not partially patch earlier children when a later child is unsupported', () => {
    const document = codec.decode(svg('<g id="outer"><g id="inner" fill="red" font-size="20"><rect id="a" font-size="20" width="1" height="1"/><rect id="b" width="1" height="1"/></g></g>')).document;
    const before = codec.encode(document);
    expect(() => document.ungroup('inner',new PreserveBasicStyles())).toThrow('inherited font-size would change on rect#b');
    expect(codec.encode(document)).toBe(before);
  });
  it('rejects changing group opacity contexts even if the two opacity values match', async () => {
    const storage = new MemoryStorage();
    storage.put('source.svg',svg('<g id="outer"><g id="p" opacity=".5"><rect id="r" width="10" height="10"/><rect id="s" width="10" height="10"/></g><g id="q" opacity=".5"/></g>'));
    const e = preserving(storage); await e.setup('read source.svg'); const before = await e.run('tree');
    for (const command of ['ungroup p','addto q r','group pair r q']) {
      expect(await e.run(command)).toBe('error: cannot preserve style: group opacity context would change');
      expect(await e.run('tree')).toBe(before);
    }
  });
  it('allows movement within a shared opacity context and keeps object opacity', async () => {
    const storage = new MemoryStorage();
    storage.put('source.svg',svg('<g id="p" opacity=".5" fill="red"><g id="q"/><g id="branch" opacity=".4"><rect id="r" width="1" height="1"/></g></g>'));
    const e = preserving(storage); await e.setup('read source.svg','addto q branch');
    expect(await e.run('show branch')).toContain('opacity=0.4');
  });
  it.each([false,true])('runs the real source CLI with the startup mode and writes valid SVG (%s)', async preserve => {
    const directory = await mkdtemp(join(tmpdir(),'svg-style-mode-'));
    try {
      const path = join(directory,'out.svg');
      const script = ['init','create g outer','create g inner in outer','set inner fill red','create rect r 1 2 3 4 in inner',
        'ungroup inner',`save ${JSON.stringify(path)}`,'create box b 1 2 3 4 "Title"'].join('\n')+'\n';
      const result = spawnSync(process.execPath,['--import','tsx','src/bootstrap/Main.ts',...(preserve?['--preserve-style']:[])],{input:script,encoding:'utf8'});
      expect(result.status).toBe(0); expect(result.stderr).toBe('');
      expect(result.stdout.split('\n').filter(line=>line.startsWith('error:'))).toEqual(['error: unknown shape type: box (is the plugin loaded?)']);
      const document = codec.decode(await readFile(path,'utf8')).document;
      expect(document.find('r').attributes.fill).toBe(preserve?'red':undefined);
    } finally { await rm(directory,{recursive:true,force:true}); }
  });
});
