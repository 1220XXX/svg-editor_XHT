import { describe, expect, it } from 'vitest';
import { Readable, PassThrough } from 'node:stream';
import { Repl } from '../src/cli/Repl.js';
import { CliController } from '../src/cli/CliController.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { CommandFactory } from '../src/application/commands/CommandFactory.js';
import { ShapeFactory } from '../src/domain/factories/ShapeFactory.js';
import { TestEditor } from './TestEditor.js';

describe('real input and terminal formatting', () => {
  it.each([false, true])('reads lines serially and exits at EOF (interactive=%s)', async interactive => {
    const factory = new ShapeFactory();
    const controller = new CliController(new EditorSession(factory), new CommandFactory(factory));
    const output = new PassThrough(); let text = '';
    output.on('data', chunk => { text += String(chunk); });
    await new Repl(controller).run(Readable.from(['init\ncreate g g\ntree\n']), output, interactive);
    expect(text).toContain('canvas 800x600 created'); expect(text).toContain('g#g created');
    expect(text).toContain('svg (800x600)');
    expect(text.includes('svg> ')).toBe(interactive);
  });
  it('preserves escaped quotes and backslashes in text', async () => {
    const editor = new TestEditor();
    await editor.setup('init', String.raw`create text t 0 0 "say \"hi\" at C:\\tmp"`);
    const detail = await editor.run('show t');
    expect(detail).toContain(JSON.stringify('say "hi" at C:\\tmp'));
  });
});
