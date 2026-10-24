import { describe, expect, it } from 'vitest';
import { TestEditor } from './TestEditor.js';

describe('task book show formatting', () => {
  it('prints the exact circle example with geometry before presentation', async () => {
    const editor = new TestEditor();
    await editor.setup('init', 'create g markers', 'create circle c1 100 100 20 red in markers');
    expect(await editor.run('show c1')).toBe('circle#c1  parent=g#markers\n  cx=100 cy=100 r=20\n  fill=red');
  });
  it.each([
    ['rect', '1 2 3 4', 'x=1 y=2 width=3 height=4'],
    ['ellipse', '1 2 3 4', 'cx=1 cy=2 rx=3 ry=4'],
    ['line', '1 2 3 4', 'x1=1 y1=2 x2=3 y2=4'],
    ['text', '1 2 "My Diagram"', 'x=1 y=2'],
  ])('keeps %s geometry on one line', async (type, parameters, geometry) => {
    const editor = new TestEditor();
    await editor.setup('init', `create ${type} s ${parameters}`, 'set s stroke black');
    const lines = (await editor.run('show s')).split('\n');
    expect(lines[0]).toBe(`${type}#s  parent=svg`);
    expect(lines[1]).toBe(`  ${geometry}`);
    expect(lines[2]).toBe('  stroke=black');
    if (type === 'text') expect(lines[3]).toBe('  text="My Diagram"');
  });
  it('prints a group without an empty geometry line and does not change history', async () => {
    const editor = new TestEditor();
    await editor.setup('init', 'create g g', 'set g fill red');
    expect(await editor.run('show g')).toBe('g#g  parent=svg\n  fill=red');
    await editor.setup('undo');
    expect(await editor.run('show g')).toBe('g#g  parent=svg');
  });
});
