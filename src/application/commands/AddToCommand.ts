import type { SvgDocument } from '../../domain/SvgDocument.js';
import { EditingCommand } from './EditingCommand.js';

export class AddToCommand extends EditingCommand {
  override apply(document: SvgDocument): string {
    this.args.expect(2); const gid = this.args.value(0), id = this.args.value(1);
    document.addTo(gid, id); return `${document.find(id).label} moved into g#${gid}`;
  }
}
