import { describe, expect, it } from 'vitest';
import { SvgDocument } from '../src/domain/SvgDocument.js';
import { Group } from '../src/domain/shapes/Group.js';
import { ShapeFactory } from '../src/domain/factories/ShapeFactory.js';
import { SvgCodec } from '../src/infrastructure/svg/SvgCodec.js';
import { MemoryStorage } from './MemoryStorage.js';
import { TestEditor } from './TestEditor.js';

const codec = new SvgCodec(new ShapeFactory());
const svg = (body = '', id = 'drawing') =>
  `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" width="100" height="100">${body}</svg>`;
const pair = '<rect id="a" x="1" y="2" width="3" height="4"/><circle id="b" cx="5" cy="6" r="7"/>';

describe('SVG document root identity', () => {
  it('round trips the root id independently of styles, transforms and the shape count', () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" id="图&amp;drawing" width="100" height="100" fill="red" transform="translate(2,3)"><g id="scene"><rect id="r" x="1" y="2" width="3" height="4"/></g></svg>';
    const { document, warnings } = codec.decode(source);
    expect(document.rootId).toBe('图&drawing'); expect(document.presentation).toEqual({ fill: 'red' });
    expect(document.size).toBe(2); expect(warnings).toEqual([]);
    expect(document.find('r').attributes).toMatchObject({ x: '3', y: '5' });
    const encoded = codec.encode(document);
    expect(encoded).toContain('id="图&amp;drawing"'); expect(encoded).not.toContain('transform=');
    const restored = codec.decode(encoded).document;
    expect(restored.rootId).toBe(document.rootId); expect(restored.presentation).toEqual(document.presentation);
    expect(restored.find('r').attributes).toEqual(document.find('r').attributes);
  });
  it('keeps an unnamed root unnamed without adding it to the element count', () => {
    const { document, warnings } = codec.decode('<svg width="100" height="100"/>');
    expect(document.rootId).toBeUndefined(); expect(document.size).toBe(0); expect(warnings).toEqual([]);
    expect(codec.encode(document)).not.toContain('id=');
  });
  it.each(['rect', 'g', 'text'])('reserves the root id before auto assigning an unnamed %s', type => {
    const { document, warnings } = codec.decode(svg(`<g id="parent"><${type}/></g>`, `${type}1`));
    expect(warnings).toEqual([`warning: assigned id ${type}2 to unnamed <${type}>`]);
    expect(document.find(`${type}2`).type).toBe(type);
  });
  it('reserves both the root id and later explicit shape ids before auto assignment', () => {
    const { document, warnings } = codec.decode(svg('<rect/><rect id="rect2"/>', 'rect1'));
    expect(warnings).toEqual(['warning: assigned id rect3 to unnamed <rect>']);
    expect(document.children.map(shape => shape.id)).toEqual(['rect3', 'rect2']);
  });
  it.each(['<rect id="drawing"/>', '<g id="parent"><circle id="drawing"/></g>'])('rejects root/descendant collisions: %s', body => {
    expect(() => codec.decode(svg(body))).toThrow('id already exists: drawing');
  });
  it('keeps root and child ids case sensitive', () => {
    const document = codec.decode(svg('<g id="drawing"/>', 'Drawing')).document;
    expect(document.rootId).toBe('Drawing'); expect(document.find('drawing').type).toBe('g');
  });
  it.each(['', 'bad id', 'bad/id', '\u0001'])('shares the shape id validation rules (%j)', id => {
    let shapeError: unknown;
    try { new Group(id); } catch (error) { shapeError = error; }
    expect(shapeError).toBeInstanceOf(Error);
    expect(() => new SvgDocument(100, 100, id)).toThrow((shapeError as Error).message);
  });
  it('validates an explicitly empty root id instead of silently discarding it', () => {
    expect(() => codec.decode(svg('', ''))).toThrow('invalid id:');
  });
  it('enforces root uniqueness in the domain when adding entire subtrees or grouping', () => {
    const document = new SvgDocument(100, 100, 'drawing');
    document.add(new Group('a')); document.add(new Group('b'));
    const subtree = new Group('nested'); subtree.insert(new Group('drawing'));
    expect(() => document.add(subtree)).toThrow('id already exists: drawing');
    expect(() => document.group('drawing', ['a', 'b'])).toThrow('id already exists: drawing');
    expect(document.children.map(shape => shape.id)).toEqual(['a', 'b']);
    expect(document.clone().rootId).toBe('drawing');
  });
  it('rejects CLI collisions without consuming redo and keeps the root outside shape editing', async () => {
    const storage = new MemoryStorage(); storage.put('source.svg', svg(pair));
    const e = new TestEditor(storage, codec); await e.setup('read source.svg', 'move a 10 0', 'undo');
    const before = await e.run('tree');
    for (const command of ['create g drawing', 'group drawing a b']) {
      expect(await e.run(command)).toBe('error: id already exists: drawing');
      expect(await e.run('tree')).toBe(before);
    }
    for (const command of ['show drawing', 'tree drawing', 'move drawing 1 2', 'scale drawing 2', 'set drawing fill blue', 'delete drawing']) {
      expect(await e.run(command)).toBe('error: no such shape: drawing');
    }
    expect(await e.run('create g child in drawing')).toBe('error: no such container: drawing');
    await e.setup('redo'); expect(await e.run('show a')).toContain('x=11');
  });
  it.each([
    { edits: ['move a 10 0', 'undo'], x: '1', width: 100 },
    { edits: ['move a 10 0', 'undo', 'redo'], x: '11', width: 100 },
    { edits: ['delete a', 'undo'], x: '1', width: 100 },
    { edits: ['canvas 200 300'], x: '1', width: 200 },
  ])('preserves root identity through snapshots and document cloning ($edits)', async ({ edits, x, width }) => {
    const storage = new MemoryStorage(); storage.put('source.svg', svg(pair));
    const e = new TestEditor(storage, codec); await e.setup('read source.svg', ...edits, 'save copy.svg');
    const restored = codec.decode(await storage.read('copy.svg')).document;
    expect(restored.rootId).toBe('drawing'); expect(restored.find('a').attributes.x).toBe(x);
    expect(restored.width).toBe(width); expect(restored.size).toBe(2);
    await e.setup('read copy.svg'); expect((await e.run('tree')).split('\n')[0]).toBe(`svg (${width}x${restored.height})`);
  });
  it('preserves the current root, default save path and redo after failed imports', async () => {
    const storage = new MemoryStorage(); storage.put('source.svg', svg(pair));
    storage.put('duplicate.svg', svg('<g id="bad"/>', 'bad'));
    storage.put('invalid.svg', svg('', 'bad id'));
    const e = new TestEditor(storage, codec);
    await e.setup('read source.svg', 'save copy.svg', 'move a 10 0', 'undo');
    const before = await e.run('tree');
    expect(await e.run('read duplicate.svg')).toBe('error: id already exists: bad');
    expect(await e.run('read invalid.svg')).toBe('error: invalid id: bad id');
    expect(await e.run('tree')).toBe(before);
    await e.setup('redo'); expect(await e.run('save')).toBe('saved to source.svg (2 elements)');
    const restored = codec.decode(await storage.read('source.svg')).document;
    expect(restored.rootId).toBe('drawing'); expect(restored.find('a').attributes.x).toBe('11');
    expect(codec.decode(await storage.read('copy.svg')).document.find('a').attributes.x).toBe('1');
  });
  it('releases the old root identity when reading another document or initializing', async () => {
    const storage = new MemoryStorage(); storage.put('first.svg', svg('', 'first'));
    storage.put('second.svg', svg('', 'second'));
    const e = new TestEditor(storage, codec); await e.setup('read first.svg', 'read second.svg', 'create g first');
    expect(await e.run('create g second')).toBe('error: id already exists: second');
    await e.setup('init', 'create g second', 'save fresh.svg');
    expect(codec.decode(await storage.read('fresh.svg')).document.rootId).toBeUndefined();
  });
});
