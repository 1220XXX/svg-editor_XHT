import type { SvgDocument } from '../../domain/SvgDocument.js';
import { Numeric } from '../../domain/Numeric.js';
import { EditingCommand } from './EditingCommand.js';

export class MoveCommand extends EditingCommand {
  override apply(document: SvgDocument): string {
    this.args.expect(3); const shape = document.find(this.args.value(0));
    const dx = this.args.number(1, 'dx'), dy = this.args.number(2, 'dy');
    shape.move(dx, dy); return this.describe(document, false);
  }
  protected override undoMessage(document: SvgDocument): string { return this.describe(document, true); }
  private describe(document: SvgDocument, restored: boolean): string {
    const shape = document.find(this.args.value(0));
    const position = shape.position;
    const prefix = `${shape.label} moved${restored ? ' back' : ''}`;
    if (position) return `${prefix} to (${position.map(value => Numeric.format(value)).join(',')})`;
    const direction = restored ? -1 : 1;
    const dx = Numeric.format(this.args.number(1, 'dx') * direction);
    const dy = Numeric.format(this.args.number(2, 'dy') * direction);
    return `${prefix} by (${dx},${dy})`;
  }
}
