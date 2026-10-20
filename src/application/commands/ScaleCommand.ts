import type { SvgDocument } from '../../domain/SvgDocument.js';
import { EditingCommand } from './EditingCommand.js';

export class ScaleCommand extends EditingCommand {
  override apply(document: SvgDocument): string {
    this.args.expect(2); const shape = document.find(this.args.value(0));
    const factor = this.args.number(1, 'scale factor'); shape.scale(factor); return `${shape.label} scaled by ${factor}`;
  }
}
