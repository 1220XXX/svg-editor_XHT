import type { SvgDocument } from '../../domain/SvgDocument.js';
import { EditingCommand } from './EditingCommand.js';

export class BackCommand extends EditingCommand {
  override apply(document: SvgDocument): string {
    this.args.expect(1); const id = this.args.value(0);
    document.reorder(id, false); return `${document.find(id).label} sent to back`;
  }
}
