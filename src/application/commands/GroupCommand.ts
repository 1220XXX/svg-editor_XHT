import type { SvgDocument } from '../../domain/SvgDocument.js';
import { EditingCommand } from './EditingCommand.js';
import type { Argument } from '../Argument.js';
import type { ReparentingStylePolicy } from '../../domain/styles/ReparentingStylePolicy.js';
import { FollowParentStyles } from '../../domain/styles/FollowParentStyles.js';

export class GroupCommand extends EditingCommand {
  constructor(tokens: readonly Argument[], private readonly styles: ReparentingStylePolicy = new FollowParentStyles()) { super(tokens); }
  override apply(document: SvgDocument): string {
    this.args.expect(1, Number.MAX_SAFE_INTEGER);
    const group = document.group(this.args.value(0), this.args.values(1), this.styles);
    return `${group.label} created with ${group.children.length} children`;
  }
  protected override undoMessage(): string {
    return `g#${this.args.value(0)} ungrouped (${this.args.length - 1} children restored)`;
  }
}
