import type { Argument } from '../Argument.js';
import type { SvgDocument } from '../../domain/SvgDocument.js';
import type { ShapeFactory } from '../../domain/factories/ShapeFactory.js';
import { EditorError } from '../../domain/errors/EditorError.js';
import { EditingCommand } from './EditingCommand.js';

export class CreateCommand extends EditingCommand {
  private createdLabel = '';
  constructor(tokens: readonly Argument[], private readonly factory: ShapeFactory) { super(tokens); }
  override apply(document: SvgDocument): string {
    this.args.expect(2, 9);
    const hasParent = this.args.keyword(this.args.length - 2, 'in');
    const end = hasParent ? this.args.length - 2 : this.args.length;
    if (end < 2) throw new EditorError("missing id before 'in' clause");
    const shape = this.factory.create(this.args.value(0), this.args.value(1), this.args.values(2, end));
    const parentId = hasParent ? this.args.value(this.args.length - 1) : undefined;
    document.add(shape, parentId);
    this.createdLabel = shape.label;
    return `${shape.label} created${parentId === undefined ? '' : ` in g#${parentId}`}`;
  }
  protected override undoMessage(): string { return `${this.createdLabel} deleted`; }
}
