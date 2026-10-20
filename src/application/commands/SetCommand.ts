import type { SvgDocument } from '../../domain/SvgDocument.js';
import { EditingCommand } from './EditingCommand.js';

export class SetCommand extends EditingCommand {
  override apply(document: SvgDocument): string {
    this.args.expect(3); const shape = document.find(this.args.value(0));
    shape.set(this.args.value(1), this.args.value(2));
    return `${shape.label} updated: ${this.args.value(1)}=${JSON.stringify(this.args.value(2))}`;
  }
}
