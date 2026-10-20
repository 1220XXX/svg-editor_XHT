import type { CommandContext } from '../ports/CommandContext.js';
import { Command } from './Command.js';

export class SaveCommand extends Command {
  
  override async execute(session: CommandContext): Promise<readonly string[]> {
    this.args.expect(0, 1); return [await session.save(this.args.length ? this.args.value(0) : undefined)];
  }
}
