import type { CommandContext } from '../ports/CommandContext.js';
import { Command } from './Command.js';

export class ShowCommand extends Command {
  
  override async execute(session: CommandContext): Promise<readonly string[]> {
    this.args.expect(1); return session.show(this.args.value(0));
  }
}
