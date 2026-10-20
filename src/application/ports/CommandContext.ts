import type { TreeNode } from '../TreeNode.js';
import type { ReversibleEdit } from './ReversibleEdit.js';

export interface CommandContext {
  init(width: number, height: number): string;
  canvas(width?: number, height?: number): string;
  edit(command: ReversibleEdit): string;
  undo(): string;
  redo(): string;
  tree(id?: string): TreeNode;
  show(id: string): readonly string[];
  read(path: string): Promise<readonly string[]>;
  save(path?: string): Promise<string>;
}
