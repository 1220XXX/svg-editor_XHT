import { describe, expect, it } from 'vitest';
import { TestEditor } from './TestEditor.js';

describe('tree columns and hierarchy', () => {
  it('matches the aligned task-book tree including mixed depths', async () => {
    const e = new TestEditor();
    await e.setup('init', 'create rect bg 0 0 800 600 #ffffff', 'create text title 20 40 "My Diagram"',
      'create circle c1 100 100 20 red', 'create rect box 200 80 60 60 #3366ff', 'group markers c1 box');
    expect(await e.run('tree')).toBe([
      'svg (800x600)',
      '├── rect#bg        x=0 y=0 w=800 h=600 fill=#ffffff',
      '├── text#title     (20,40) "My Diagram"',
      '└── g#markers',
      '    ├── circle#c1  cx=100 cy=100 r=20 fill=red',
      '    └── rect#box   x=200 y=80 w=60 h=60 fill=#3366ff',
    ].join('\n'));
  });
  it('aligns attributes across branches without losing continuation lines or sibling order', async () => {
    const e = new TestEditor();
    await e.setup('init', 'create g p', 'create g nested in p', 'create rect long-name 1 2 3 4 in nested',
      'create circle c 5 6 7 in p', 'create text t 8 9 "A"');
    expect(await e.run('tree')).toBe([
      'svg (800x600)', '├── g#p', '│   ├── g#nested',
      '│   │   └── rect#long-name  x=1 y=2 w=3 h=4',
      '│   └── circle#c            cx=5 cy=6 r=7',
      '└── text#t                  (8,9) "A"',
    ].join('\n'));
  });
  it('renders empty trees, leaves and styled subtree roots without trailing spaces', async () => {
    const e = new TestEditor(); await e.setup('init');
    expect(await e.run('tree')).toBe('svg (800x600)');
    await e.setup('create g parent', 'set parent fill red', 'create rect r 1 2 3 4 in parent', 'create g empty in parent');
    expect(await e.run('tree parent')).toBe([
      'g#parent    fill=red', '├── rect#r  x=1 y=2 w=3 h=4', '└── g#empty',
    ].join('\n'));
    expect(await e.run('tree r')).toBe('rect#r  x=1 y=2 w=3 h=4');
    expect(await e.run('tree empty')).toBe('g#empty');
  });
  it('uses display columns for Chinese ids, combining characters and emoji', async () => {
    const e = new TestEditor();
    await e.setup('init', 'create rect 长标签 1 2 3 4', 'create circle a 1 2 3',
      'create rect café 1 2 3 4', 'create rect 🐱 1 2 3 4');
    expect(await e.run('tree')).toBe([
      'svg (800x600)', '├── rect#长标签  x=1 y=2 w=3 h=4',
      '├── circle#a     cx=1 cy=2 r=3', '├── rect#café    x=1 y=2 w=3 h=4',
      '└── rect#🐱      x=1 y=2 w=3 h=4',
    ].join('\n'));
  });
  it('does not affect history and recomputes columns after deleting or restoring a long id', async () => {
    const e = new TestEditor(); await e.setup('init', 'create rect a 1 2 3 4', 'create circle longest-name 5 6 7');
    const before = await e.run('tree');
    await e.setup('delete longest-name');
    expect(await e.run('tree')).toBe('svg (800x600)\n└── rect#a  x=1 y=2 w=3 h=4');
    await e.setup('tree a', 'undo'); expect(await e.run('tree')).toBe(before);
    await e.setup('redo'); expect(await e.run('tree')).not.toContain('longest-name');
  });
});
