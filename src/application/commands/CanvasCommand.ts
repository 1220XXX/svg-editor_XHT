import type { CommandContext } from '../ports/CommandContext.js';
import { Command } from './Command.js';

export class CanvasCommand extends Command {
  
  override async execute(session: CommandContext): Promise<readonly string[]> {
    if (this.args.length !== 0 && this.args.length !== 2) this.args.expect(0);
    return [this.args.length ? session.canvas(this.args.number(0, 'width'), this.args.number(1, 'height')) : session.canvas()];
  }
}
