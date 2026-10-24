import type { SvgDocument } from '../../domain/SvgDocument.js';
import { EditingCommand } from './EditingCommand.js';

export class UngroupCommand extends EditingCommand {
  override apply(document: SvgDocument): string {
    this.args.expect(1); const id = this.args.value(0);
    const count = document.ungroup(id); return `g#${id} ungrouped (${count} children promoted)`;
  }
  protected override undoMessage(document: SvgDocument): string {
    const shape = document.find(this.args.value(0));
    return `${shape.label} restored with ${shape.children.length} children`;
  }
}
