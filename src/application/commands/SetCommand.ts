import type { SvgDocument } from '../../domain/SvgDocument.js';
import { EditingCommand } from './EditingCommand.js';

export class SetCommand extends EditingCommand {
  override apply(document: SvgDocument): string {
    this.args.expect(3); const shape = document.find(this.args.value(0));
    shape.set(this.args.value(1), this.args.value(2));
    return `${shape.label} updated: ${this.args.value(1)}=${JSON.stringify(this.args.value(2))}`;
  }
  protected override undoMessage(document: SvgDocument): string {
    const shape = document.find(this.args.value(0)), attribute = this.args.value(1);
    const value = attribute === 'text' ? shape.content : shape.attributes[attribute];
    return `${shape.label} updated: ${attribute}=${value === undefined ? '<unset>' : JSON.stringify(value)}`;
  }
}
