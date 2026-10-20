import { describe, expect, it } from 'vitest';
import { TestEditor } from './TestEditor.js';

describe('Command + Memento history', () => {
  it('restores exact state through edits, delete, undo and redo', async () => {
    const e = new TestEditor(); await e.setup('init', 'create rect r 0.1 2 3 4', 'set r fill red');
    const before = await e.run('tree');
    await e.setup('scale r 3', 'move r 7 8', 'delete r', 'undo', 'undo', 'undo');
    expect(await e.run('tree')).toBe(before);
    await e.setup('redo', 'redo', 'redo'); expect(await e.run('tree')).not.toContain('rect#r');
  });
  it('keeps redo on failure and clears it on a successful new edit', async () => {
    const e = new TestEditor(); await e.setup('init','create g g','create rect r 1 2 3 4','undo');
    expect(await e.run('scale g 0')).toBe('error: scale factor must be positive');
    await e.setup('redo','undo','create circle c 1 2 3');
    expect(await e.run('redo')).toBe('error: nothing to redo');
  });
  it('enforces barriers and allows read only displays between edits', async () => {
    const e = new TestEditor(); await e.setup('init');
    expect(await e.run('undo')).toBe('error: undo not allowed after io command');
    await e.setup('create g g','help','tree','canvas','undo','redo','canvas 100 200');
    expect(await e.run('redo')).toBe('error: undo not allowed after io command');
    await e.setup('create g h','undo');
    expect(await e.run('tree')).not.toContain('g#h');
  });
  it('keeps the entire document unchanged when an edit overflows', async () => {
    const e = new TestEditor(); await e.setup('init','create g g','create rect r 1e308 0 1 2 in g','create rect s 1 0 1 2 in g');
    const before = await e.run('tree');
    expect(await e.run('scale g 10')).toContain('error:'); expect(await e.run('tree')).toBe(before);
    await e.setup('undo'); expect(await e.run('tree')).not.toContain('rect#s');
  });
});
