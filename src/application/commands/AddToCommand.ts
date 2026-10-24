import type { SvgDocument } from '../../domain/SvgDocument.js';
import { EditingCommand } from './EditingCommand.js';
import type { Argument } from '../Argument.js';
import type { ReparentingStylePolicy } from '../../domain/styles/ReparentingStylePolicy.js';
import { FollowParentStyles } from '../../domain/styles/FollowParentStyles.js';

export class AddToCommand extends EditingCommand {
  constructor(tokens: readonly Argument[], private readonly styles: ReparentingStylePolicy = new FollowParentStyles()) { super(tokens); }
  override apply(document: SvgDocument): string {
    this.args.expect(2); const gid = this.args.value(0), id = this.args.value(1);
    document.addTo(gid, id, this.styles); return `${document.find(id).label} moved into g#${gid}`;
  }
  protected override undoMessage(document: SvgDocument): string {
    const id = this.args.value(1);
    return `${document.find(id).label} moved back into ${document.parentLabel(id)}`;
  }
}
