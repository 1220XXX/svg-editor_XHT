import type { CommandContext } from '../ports/CommandContext.js';
import type { TreeNode } from '../TreeNode.js';
import { Command } from './Command.js';

export class TreeCommand extends Command {
  private readonly graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  override async execute(session: CommandContext): Promise<readonly string[]> {
    this.args.expect(0, 1);
    const root = session.tree(this.args.length ? this.args.value(0) : undefined);
    const rows = [{ prefix: '', label: root.label, details: root.details }];
    const visit = (node: TreeNode, prefix: string): void => {
      node.children.forEach((child, index) => {
        const last = index === node.children.length - 1;
        rows.push({ prefix: `${prefix}${last ? '└── ' : '├── '}`, label: child.label, details: child.details });
        visit(child, `${prefix}${last ? '    ' : '│   '}`);
      });
    };
    visit(root, '');
    const column = rows.filter(row => row.details).reduce((maximum, row) =>
      Math.max(maximum, this.width(row.prefix + row.label)), 0) + 2;
    return rows.map(row => {
      const label = row.prefix + row.label;
      return row.details ? `${label}${' '.repeat(column - this.width(label))}${row.details}` : label;
    });
  }
  private width(text: string): number {
    let columns = 0;
    for (const { segment } of this.graphemes.segment(text)) {
      if (/^[\p{Mark}\u200d]+$/u.test(segment)) continue;
      const wide = /[\u1100-\u115f\u2329\u232a\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff01-\uff60\uffe0-\uffe6]|\p{Script=Han}|\p{Emoji_Presentation}|\uFE0F|\u20E3/u;
      columns += wide.test(segment) ? 2 : 1;
    }
    return columns;
  }
}
