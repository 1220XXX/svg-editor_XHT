import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { CliController } from './CliController.js';

export class Repl {
  constructor(private readonly controller: CliController) {}
  async run(input: Readable, output: Writable, interactive: boolean): Promise<void> {
    const reader = createInterface({ input, output, terminal: interactive });
    let closed = false;
    reader.once('close', () => { closed = true; });
    if (interactive) { output.write("svg-editor 0.1 — type 'help' for commands\n"); reader.setPrompt('svg> '); reader.prompt(); }
    for await (const line of reader) {
      for (const message of await this.controller.runLine(line)) output.write(`${message}\n`);
      if (interactive && !closed) reader.prompt();
    }
  }
}
