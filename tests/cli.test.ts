import { describe, expect, it } from 'vitest';
import { TestEditor } from './TestEditor.js';

describe('CLI parsing, display and basic commands', () => {
  it('handles comments, colors, quoted text and quoted keyword in', async () => {
    const e = new TestEditor();
    expect(await e.run('  # script')).toBe('');
    expect(await e.run('help')).toContain('create');
    await e.setup('init', 'create g g', 'create rect r 1 2 3 4 #ffffff in g', 'create text t 2 3 "My Diagram" in g');
    expect(await e.run('show r')).toContain('fill=#ffffff');
    expect(await e.run('show t')).toContain('text="My Diagram"');
    await e.setup('create text keyword 1 2 "in"');
    expect(await e.run('tree g')).toContain('└── text#t');
    expect(await e.run('tree')).toContain('svg (800x600)');
  });
  it('rejects malformed input and unavailable documents without ending the session', async () => {
    const e = new TestEditor();
    expect(await e.run('tree')).toBe("error: no document. use 'init' or 'read' first");
    expect(await e.run('create text t 1 2 "open')).toBe('error: unterminated double quote');
    await e.setup('init 400 300');
    expect(await e.run('canvas 1')).toContain('error:');
    expect(await e.run('canvas')).toBe('canvas 400x300');
    expect(await e.run('create rect r NaN 0 1 2')).toContain('error: invalid x');
  });
  it('accepts empty text and escaped quotes', async () => {
    const e = new TestEditor(); await e.setup('init', 'create text t 0 0 ""');
    expect(await e.run('show t')).toContain('text=""');
    await e.setup('set t text "say \"hi\""');
    expect(await e.run('show t')).toContain('say');
  });
});
