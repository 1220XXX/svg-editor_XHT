import type { EditorSession } from '../EditorSession.js';
import { Command } from './Command.js';

export class ReadCommand extends Command {
  override get requiresDocument(): boolean { return false; }
  override async execute(session: EditorSession): Promise<readonly string[]> {
    this.args.expect(1); return session.read(this.args.value(0));
  }
}
