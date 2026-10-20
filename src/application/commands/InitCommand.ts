import type { CommandContext } from '../ports/CommandContext.js';
import { Command } from './Command.js';

export class InitCommand extends Command {
  override get requiresDocument(): boolean { return false; }
  override async execute(session: CommandContext): Promise<readonly string[]> {
    this.args.expect(0, 2);
    return [session.init(this.args.length > 0 ? this.args.number(0, 'width') : 800, this.args.length > 1 ? this.args.number(1, 'height') : 600)];
  }
}
