export interface TreeNode {
  readonly label: string;
  readonly details: string;
  readonly children: readonly TreeNode[];
}
