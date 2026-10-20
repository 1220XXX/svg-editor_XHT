import type { EditorSession } from '../EditorSession.js';
import { Command } from './Command.js';

export class UndoCommand extends Command {
  
  override async execute(session: EditorSession): Promise<readonly string[]> {
    this.args.expect(0); return [session.undo()];
  }
}
