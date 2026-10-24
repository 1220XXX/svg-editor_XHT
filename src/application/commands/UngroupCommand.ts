import type { SvgDocument } from '../../domain/SvgDocument.js';
import { EditingCommand } from './EditingCommand.js';
import type { Argument } from '../Argument.js';
import type { ReparentingStylePolicy } from '../../domain/styles/ReparentingStylePolicy.js';
import { FollowParentStyles } from '../../domain/styles/FollowParentStyles.js';

export class UngroupCommand extends EditingCommand {
  constructor(tokens: readonly Argument[], private readonly styles: ReparentingStylePolicy = new FollowParentStyles()) { super(tokens); }
  override apply(document: SvgDocument): string {
    this.args.expect(1); const id = this.args.value(0);
    const count = document.ungroup(id, this.styles); return `g#${id} ungrouped (${count} children promoted)`;
  }
  protected override undoMessage(document: SvgDocument): string {
    const shape = document.find(this.args.value(0));
    return `${shape.label} restored with ${shape.children.length} children`;
  }
}
