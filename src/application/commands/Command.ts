import type { CommandContext } from '../ports/CommandContext.js';
import { CommandArguments } from './CommandArguments.js';
import type { Argument } from '../Argument.js';

export abstract class Command {
  protected readonly args: CommandArguments;
  constructor(tokens: readonly Argument[]) { this.args = new CommandArguments(tokens); }
  get requiresDocument(): boolean { return true; }
  abstract execute(session: CommandContext): Promise<readonly string[]>;
}
