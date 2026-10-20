import type { SvgDocument } from '../../domain/SvgDocument.js';
import { EditingCommand } from './EditingCommand.js';

export class DeleteCommand extends EditingCommand {
  override apply(document: SvgDocument): string {
    this.args.expect(1); return `${document.delete(this.args.value(0))} deleted`;
  }
}
