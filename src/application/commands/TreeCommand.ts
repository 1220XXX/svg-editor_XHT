import type { EditorSession } from '../EditorSession.js';
import type { TreeNode } from '../TreeNode.js';
import { Command } from './Command.js';

export class TreeCommand extends Command {
  override async execute(session: EditorSession): Promise<readonly string[]> {
    this.args.expect(0, 1);
    const root = session.tree(this.args.length ? this.args.value(0) : undefined);
    const lines = [root.summary];
    const visit = (node: TreeNode, prefix: string): void => {
      node.children.forEach((child, index) => {
        const last = index === node.children.length - 1;
        lines.push(`${prefix}${last ? '└── ' : '├── '}${child.summary}`);
        visit(child, `${prefix}${last ? '    ' : '│   '}`);
      });
    };
    visit(root, ''); return lines;
  }
}
