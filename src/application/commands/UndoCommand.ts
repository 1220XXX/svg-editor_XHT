import type { CommandContext } from '../ports/CommandContext.js';
import { Command } from './Command.js';

export class UndoCommand extends Command {
  
  override async execute(session: CommandContext): Promise<readonly string[]> {
    this.args.expect(0); return [session.undo()];
  }
}
