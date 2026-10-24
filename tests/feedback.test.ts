import { describe, expect, it } from 'vitest';
import { TestEditor } from './TestEditor.js';

describe('editing feedback describes the resulting state', () => {
  it('matches the task-book move, set and delete undo/redo transcript', async () => {
    const e = new TestEditor();
    await e.setup('init', 'create text title 20 40 "My Diagram"', 'create circle c1 100 100 20 red',
      'create rect box 200 80 60 60 #3366ff', 'group markers c1 box');
    expect(await e.run('move c1 30 0')).toBe('circle#c1 moved to (130,100)');
    expect(await e.run('undo')).toBe('circle#c1 moved back to (100,100)');
    expect(await e.run('redo')).toBe('circle#c1 moved to (130,100)');
    expect(await e.run('set title text "My Diagram v2"')).toBe('text#title updated: text="My Diagram v2"');
    expect(await e.run('undo')).toBe('text#title updated: text="My Diagram"');
    expect(await e.run('redo')).toBe('text#title updated: text="My Diagram v2"');
    expect(await e.run('delete box')).toBe('rect#box deleted');
    expect(await e.run('undo')).toBe('rect#box restored into g#markers');
    expect(await e.run('redo')).toBe('rect#box deleted');
    expect(await e.run('show box')).toBe('error: no such shape: box');
  });
  it.each([
    ['rect', '1 2 3 4'], ['circle', '1 2 3'], ['ellipse', '1 2 3 4'],
    ['line', '1 2 3 4 black'], ['text', '1 2 "A"'],
  ])('reports the position of %s without changing its other properties', async (type, args) => {
    const e = new TestEditor(); await e.setup('init', `create ${type} a ${args}`);
    const before = await e.run('show a');
    expect(await e.run('move a 10 -2')).toBe(`${type}#a moved to (11,0)`);
    expect(await e.run('undo')).toBe(`${type}#a moved back to (1,2)`);
    expect(await e.run('show a')).toBe(before);
    expect(await e.run('redo')).toBe(`${type}#a moved to (11,0)`);
  });
  it('reports inverse deltas for group undo while restoring nested geometry exactly', async () => {
    const e = new TestEditor();
    await e.setup('init', 'create g node', 'create g inner in node', 'create rect r 0.1 0.2 3 4 in inner');
    const before = await e.run('tree');
    expect(await e.run('move node 0.2 0')).toBe('g#node moved by (0.2,0)');
    expect(await e.run('undo')).toBe('g#node moved back by (-0.2,0)');
    expect(await e.run('tree')).toBe(before);
    expect(await e.run('redo')).toBe('g#node moved by (0.2,0)');
  });
  it('reports restored omitted styles, geometry, escaped text and root parent accurately', async () => {
    const e = new TestEditor(); await e.setup('init', 'create text t 1 2 "A \\"quote\\""');
    const before = await e.run('show t');
    await e.setup('set t fill red'); expect(await e.run('undo')).toBe('text#t updated: fill=<unset>');
    expect(await e.run('show t')).toBe(before);
    await e.setup('set t x 20'); expect(await e.run('undo')).toBe('text#t updated: x="1"');
    await e.setup('set t text ""'); expect(await e.run('undo')).toBe('text#t updated: text="A \\"quote\\""');
    await e.setup('delete t'); expect(await e.run('undo')).toBe('text#t restored into svg');
  });
  it('describes restored topology, order and scale without replaying mutations', async () => {
    const e = new TestEditor(); await e.setup('init', 'create g parent', 'create rect a 1 2 3 4 in parent',
      'create circle b 5 6 7 in parent');
    const before = await e.run('tree');
    const edits = [
      ['group pair b a', 'g#pair ungrouped (2 children restored)'],
      ['front a', 'rect#a draw order restored in g#parent'],
      ['back b', 'circle#b draw order restored in g#parent'],
      ['scale parent 3', 'g#parent scale restored'],
    ];
    for (const [command, undo] of edits) {
      const applied = await e.run(command!);
      expect(await e.run('undo')).toBe(undo);
      expect(await e.run('tree')).toBe(before);
      expect(await e.run('redo')).toBe(applied);
      await e.setup('undo'); expect(await e.run('tree')).toBe(before);
    }
    await e.setup('group pair a b', 'ungroup pair');
    expect(await e.run('undo')).toBe('g#pair restored with 2 children');
    await e.setup('addto parent b'); expect(await e.run('undo')).toBe('circle#b moved back into g#pair');
    await e.setup('create g temporary'); expect(await e.run('undo')).toBe('g#temporary deleted');
  });
});
