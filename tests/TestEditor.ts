import { ShapeFactory } from '../src/domain/factories/ShapeFactory.js';
import { EditorSession } from '../src/application/EditorSession.js';
import { CommandFactory } from '../src/application/commands/CommandFactory.js';
import { CliController } from '../src/cli/CliController.js';
import type { TextStorage } from '../src/application/ports/TextStorage.js';
import type { DocumentCodec } from '../src/application/ports/DocumentCodec.js';

export class TestEditor {
  private readonly cli: CliController;
  constructor(storage?: TextStorage, codec?: DocumentCodec) {
    const factory = new ShapeFactory();
    this.cli = new CliController(new EditorSession(factory, storage, codec), new CommandFactory(factory));
  }
  async run(line: string): Promise<string> { return (await this.cli.runLine(line)).join('\n'); }
  async setup(...lines: string[]): Promise<void> {
    for (const line of lines) {
      const output = await this.run(line);
      if (output.startsWith('error:')) throw new Error(`${line}: ${output}`);
    }
  }
}
