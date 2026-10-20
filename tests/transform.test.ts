import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ShapeFactory } from '../src/domain/factories/ShapeFactory.js';
import { SvgCodec } from '../src/infrastructure/svg/SvgCodec.js';
import { TestEditor } from './TestEditor.js';
import { MemoryStorage } from './MemoryStorage.js';

const codec = new SvgCodec(new ShapeFactory());
const svg = (body: string) => `<svg width="400" height="200">${body}</svg>`;
describe('optional SVG transform enhancement', () => {
  it('imports the background example with correct nested geometry and typography', () => {
    const source = readFileSync('examples/transform-original.svg','utf8');
    const { document, warnings } = codec.decode(source);
    expect(warnings).toHaveLength(2);
    expect(document.find('a').attributes.x).toBe('60'); expect(document.find('a').attributes.y).toBe('40');
    expect(document.find('rect1').attributes).toMatchObject({ x:'260', y:'40', width:'96', height:'48' });
    expect(document.find('text1').attributes).toMatchObject({ x:'308', y:'70.4', 'font-size':'12.8' });
    expect(codec.encode(document)).not.toContain('transform=');
  });
  it.each([
    ['translate(10,20) scale(2)', '12', '24'],
    ['scale(2) translate(10,20)', '22', '44'],
    ['translate(10)', '11', '2'],
    ['scale(2,2)', '2', '4'],
    ['translate(1e1 -2e1), scale(.5)', '10.5', '-19'],
  ])('respects operation order and supported syntax: %s', (transform, x, y) => {
    const { document } = codec.decode(svg(`<rect id="r" x="1" y="2" width="3" height="4" transform="${transform}"/>`));
    expect(document.find('r').attributes).toMatchObject({ x, y });
  });
  it('scales inherited stroke and font presentation exactly once', () => {
    const source = svg('<g id="a" transform="scale(2)" stroke="black" stroke-width="3" font-size="20"><g id="b" transform="translate(10,0) scale(.5)"><text id="t" x="1" y="2">A</text></g><line id="l" x1="0" y1="0" x2="1" y2="1"/></g>');
    const { document } = codec.decode(source);
    expect(document.find('t').attributes).toMatchObject({ x:'21', y:'2' });
    expect(document.find('t').attributes['font-size']).toBeUndefined(); // net scale 1 preserves inherited 20
    expect(document.find('l').attributes['stroke-width']).toBe('6');
    const direct = codec.decode(svg('<text id="t" transform="scale(2)" x="1" y="2">A</text>')).document;
    expect(direct.find('t').attributes['font-size']).toBe('32');
  });
  it('normalizes root transforms too', () => {
    const { document } = codec.decode('<svg width="100" height="100" transform="translate(2,3) scale(2)"><circle id="c" cx="1" cy="2" r="3"/></svg>');
    expect(document.find('c').attributes).toMatchObject({ cx:'4', cy:'7', r:'6' });
  });
  it.each(['rotate(30)','skewX(10)','matrix(1,0,0,1,0,0)','scale(2,3)','scale(0)','scale(-1)',
    'translate(1,)', 'scale(2) garbage', 'translate()', 'scale(2),', 'translate(1 2 3)'])('rejects unsupported/invalid transform: %s', transform => {
    expect(() => codec.decode(svg(`<g id="g" transform="${transform}"/>`))).toThrow();
  });
  it('permits normal edits and exact undo/redo after import, with stable round trips', async () => {
    const storage = new MemoryStorage(); storage.put('source.svg',readFileSync('examples/transform-original.svg','utf8'));
    const e = new TestEditor(storage,codec); await e.setup('read source.svg');
    const before = await e.run('tree');
    await e.setup('move nodeB 10 20','scale nodeB 2','undo','undo'); expect(await e.run('tree')).toBe(before);
    await e.setup('redo','redo','save normalized.svg'); const after = await e.run('tree');
    await e.setup('read normalized.svg'); expect(await e.run('tree')).toBe(after);
    expect(await storage.read('normalized.svg')).not.toContain('transform=');
    await e.setup('create g newParent','addto newParent nodeB');
    expect(await e.run('show rect1')).toContain('x=540');
  });
});
