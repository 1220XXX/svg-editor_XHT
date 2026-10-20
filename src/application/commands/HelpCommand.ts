import type { CommandContext } from '../ports/CommandContext.js';
import type { Argument } from '../Argument.js';
import { Command } from './Command.js';

export class HelpCommand extends Command {
  constructor(tokens: readonly Argument[], private readonly syntaxes: readonly string[]) { super(tokens); }
  override get requiresDocument(): boolean { return false; }
  override async execute(_session: CommandContext): Promise<readonly string[]> {
    this.args.expect(0); return this.syntaxes;
  }
}
