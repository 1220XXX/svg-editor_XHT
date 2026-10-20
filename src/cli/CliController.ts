import type { EditorSession } from '../application/EditorSession.js';
import type { CommandFactory } from '../application/commands/CommandFactory.js';
import { Tokenizer } from './parsing/Tokenizer.js';
import { OutputFormatter } from './formatting/OutputFormatter.js';

export class CliController {
  private readonly tokenizer = new Tokenizer();
  private readonly formatter = new OutputFormatter();
  constructor(private readonly session: EditorSession, private readonly commands: CommandFactory) {}
  async runLine(line: string): Promise<readonly string[]> {
    try {
      const tokens = this.tokenizer.parse(line);
      if (!tokens.length) return [];
      return await this.session.execute(this.commands.create(tokens));
    } catch (error) { return [this.formatter.error(error)]; }
  }
}
