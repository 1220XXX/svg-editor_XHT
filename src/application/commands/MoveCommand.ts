import type { SvgDocument } from '../../domain/SvgDocument.js';
import { EditingCommand } from './EditingCommand.js';

export class MoveCommand extends EditingCommand {
  override apply(document: SvgDocument): string {
    this.args.expect(3); const shape = document.find(this.args.value(0));
    const dx = this.args.number(1, 'dx'), dy = this.args.number(2, 'dy');
    shape.move(dx, dy); return `${shape.label} moved by (${dx},${dy})`;
  }
}
