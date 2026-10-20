import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { TestEditor } from './TestEditor.js';
import { MemoryStorage } from './MemoryStorage.js';
import { SvgCodec } from '../src/infrastructure/svg/SvgCodec.js';
import { ShapeFactory } from '../src/domain/factories/ShapeFactory.js';

const codec = new SvgCodec(new ShapeFactory());
describe('task book acceptance', () => {
  it('replays the complete representative transcript', async () => {
    const files = new MemoryStorage(); const e = new TestEditor(files, codec);
    await e.setup('init 800 600','create rect bg 0 0 800 600 #ffffff','create text title 20 40 "My Diagram"',
      'create circle c1 100 100 20 red','create rect box 200 80 60 60 #3366ff','group markers c1 box');
    const before = await e.run('tree');
    await e.setup('move c1 30 0'); expect(await e.run('show c1')).toContain('cx=130');
    await e.setup('undo'); expect(await e.run('tree')).toBe(before);
    await e.setup('redo'); expect(await e.run('show c1')).toContain('cx=130');
    await e.setup('set title text "My Diagram v2"','undo'); expect(await e.run('show title')).toContain('text="My Diagram"');
    expect(await e.run('group bad c1 markers')).toBe('error: cannot group a container into its own descendant: markers');
    await e.setup('delete box','undo'); expect(await e.run('show box')).toContain('parent=g#markers');
    expect(await e.run('save demo.svg')).toBe('saved to demo.svg (5 elements)');
    expect(await e.run('undo')).toBe('error: undo not allowed after io command');
    files.put('other.svg', readFileSync('examples/other.svg','utf8'));
    expect(await e.run('read other.svg')).toBe('warning: assigned id rect1 to unnamed <rect>\nread other.svg (7 elements)');
    expect(await e.run('tree')).toContain('svg (400x300)');
  });
  it('builds the task book flowchart with nested containers and 8 elements', async () => {
    const e = new TestEditor(new MemoryStorage(), codec);
    const script = readFileSync('examples/flowchart.cli','utf8');
    for (const line of script.split(/\r?\n/)) expect(await e.run(line), line).not.toMatch(/^error:/);
    expect(await e.run('save temp.svg')).toBe('saved to temp.svg (8 elements)');
    expect(await e.run('show process')).toContain('y=100');
    expect(await e.run('show process-label')).toContain('处理数据 v2');
  });
  it.each([
    ['create g g','id already exists: g'],
    ['delete missing','no such shape: missing'],
    ['create g new in missing','no such container: missing'],
    ['create g new in r','not a container: r'],
    ['create hexagon x','unknown shape type: hexagon (is the plugin loaded?)'],
    ['ungroup g','cannot ungroup top-level container: g'],
    ['scale r 0','scale factor must be positive'],
    ['scale r -1','scale factor must be positive'],
    ['set r arbitrary 1','unknown attribute: arbitrary'],
  ])('matches the required error for %s', async (command, message) => {
    const e = new TestEditor(); await e.setup('init','create g g','create rect r 1 2 3 4');
    const before = await e.run('tree'); expect(await e.run(command)).toBe(`error: ${message}`);
    expect(await e.run('tree')).toBe(before);
  });
  it('replays piped stdin through the real CLI and exits on EOF', () => {
    const result = spawnSync(process.execPath, ['--import','tsx','src/bootstrap/Main.ts'], {
      input: 'init 40 20\ncreate rect r 1 2 3 4 #fff\nshow r\ninvalid\ntree\n', encoding: 'utf8',
    });
    expect(result.status).toBe(0); expect(result.stderr).toBe('');
    expect(result.stdout).toContain('canvas 40x20 created'); expect(result.stdout).toContain('fill=#fff');
    expect(result.stdout).toContain('error: unknown command: invalid'); expect(result.stdout).toContain('svg (40x20)');
  });
});
