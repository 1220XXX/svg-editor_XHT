import type { SvgDocument } from '../../domain/SvgDocument.js';
import { EditorError } from '../../domain/errors/EditorError.js';
import type { CommandContext } from '../ports/CommandContext.js';
import { DocumentMemento } from '../history/DocumentMemento.js';
import { Command } from './Command.js';

export abstract class EditingCommand extends Command {
  private before: DocumentMemento | undefined;
  private after: DocumentMemento | undefined;
  private result = '';
  abstract apply(document: SvgDocument): string;
  override async execute(session: CommandContext): Promise<readonly string[]> { return [session.edit(this)]; }
  remember(before: DocumentMemento, after: DocumentMemento, result: string): void {
    this.before = before; this.after = after; this.result = result;
  }
  undo(): { document: SvgDocument; message: string } {
    if (!this.before) throw new EditorError('command was not executed');
    return { document: this.before.restore(), message: `undone: ${this.result}` };
  }
  redo(): { document: SvgDocument; message: string } {
    if (!this.after) throw new EditorError('command was not executed');
    return { document: this.after.restore(), message: `redone: ${this.result}` };
  }
}
