import { describe, expect, it } from 'vitest';
import { TestEditor } from './TestEditor.js';

describe('tree operations are atomic history units', () => {
  it.each(['group pair', 'group pair a'])('rejects fewer than two members atomically: %s', async command => {
    const e = new TestEditor();
    await e.setup('init', 'create rect a 1 2 3 4', 'move a 10 0', 'undo');
    const before = await e.run('tree');
    expect(await e.run(command)).toBe('error: group requires at least two shapes');
    expect(await e.run('tree')).toBe(before);
    await e.setup('redo'); expect(await e.run('show a')).toContain('x=11');
    await e.setup('create circle b 0 0 1', 'group pair b a');
    expect(await e.run('show pair')).toContain('parent=svg');
  });
  it('groups in original order, undo restores all parents and indices', async () => {
    const e = new TestEditor();
    await e.setup('init','create g parent','create rect a 0 0 1 1 in parent','create circle b 2 2 1 in parent','create text c 0 0 "C" in parent');
    const before = await e.run('tree');
    await e.setup('group sub c a');
    const grouped = await e.run('tree');
    expect(grouped.indexOf('rect#a')).toBeLessThan(grouped.indexOf('text#c'));
    await e.setup('undo'); expect(await e.run('tree')).toBe(before);
    await e.setup('redo'); expect(await e.run('tree')).toBe(grouped);
    await e.setup('ungroup sub'); expect(await e.run('tree')).not.toContain('g#sub');
    await e.setup('undo'); expect(await e.run('tree')).toBe(grouped);
  });
  it('groups across parents and restores the exact tree on undo', async () => {
    const e = new TestEditor();
    await e.setup('init','create g p','create g q','create rect a 1 2 3 4 in p','create circle b 5 6 7 in q');
    const before = await e.run('tree');
    await e.setup('group cross b a');
    expect(await e.run('show cross')).toContain('parent=svg');
    const tree = await e.run('tree'); expect(tree.indexOf('rect#a')).toBeLessThan(tree.indexOf('circle#b'));
    await e.setup('undo'); expect(await e.run('tree')).toBe(before);
  });
  it('rejects ancestor selection, cyclic reparenting and top-level ungroup', async () => {
    const e = new TestEditor(); await e.setup('init','create g p','create g q in p','create rect r 1 2 3 4 in q');
    const before = await e.run('tree');
    expect(await e.run('group bad r p')).toBe('error: cannot group a container into its own descendant: p');
    expect(await e.run('addto q p')).toContain('error: cannot move a container');
    expect(await e.run('addto p p')).toContain('error: cannot move a container');
    expect(await e.run('ungroup p')).toBe('error: cannot ungroup top-level container: p');
    expect(await e.run('group bad r r')).toContain('error: duplicate group member');
    expect(await e.run('tree')).toBe(before);
  });
  it('reparents and adjusts sibling draw order with exact undo', async () => {
    const e = new TestEditor(); await e.setup('init','create g p','create g q','create g a in p','create g b in p','create g c in p');
    const before = await e.run('tree');
    await e.setup('front a'); let tree = await e.run('tree p'); expect(tree.indexOf('g#a')).toBeGreaterThan(tree.indexOf('g#c'));
    await e.setup('back c'); tree = await e.run('tree p'); expect(tree.indexOf('g#c')).toBeLessThan(tree.indexOf('g#b'));
    await e.setup('addto q b'); expect(await e.run('show b')).toContain('parent=g#q');
    await e.setup('undo','undo','undo'); expect(await e.run('tree')).toBe(before);
  });
  it('deletes and restores entire subtrees and their addressability', async () => {
    const e = new TestEditor(); await e.setup('init','create g p','create g q in p','create rect r 1 2 3 4 in q');
    const before = await e.run('tree'); await e.setup('delete p');
    expect(await e.run('show r')).toBe('error: no such shape: r');
    await e.setup('undo'); expect(await e.run('tree')).toBe(before);
    expect(await e.run('create g r')).toBe('error: id already exists: r');
  });
  it('validates in targets and permits a group nested at creation time', async () => {
    const e = new TestEditor(); await e.setup('init','create rect r 1 2 3 4');
    expect(await e.run('create g a in missing')).toBe('error: no such container: missing');
    expect(await e.run('create g a in r')).toBe('error: not a container: r');
    await e.setup('create g a'); expect(await e.run('show a')).toContain('parent=svg');
  });
});
