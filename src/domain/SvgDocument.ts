import { EditorError } from './errors/EditorError.js';
import { Numeric } from './Numeric.js';
import { Group } from './shapes/Group.js';
import { Shape } from './shapes/Shape.js';

type Location = { shape: Shape; parent: Group; index: number };

export class SvgDocument {
  private root = new Group('__document_root__');
  constructor(private canvasWidth = 800, private canvasHeight = 600) {
    this.resize(canvasWidth, canvasHeight);
  }
  get width(): number { return this.canvasWidth; }
  get height(): number { return this.canvasHeight; }
  get children(): readonly Shape[] { return this.root.children; }
  get size(): number { return this.all().length; }
  resize(width: number, height: number): void {
    Numeric.positive(width, 'canvas width'); Numeric.positive(height, 'canvas height');
    this.canvasWidth = width; this.canvasHeight = height;
  }
  get presentation(): Readonly<Record<string, string>> {
    const { id: _id, ...attributes } = this.root.attributes; return attributes;
  }
  importPresentation(name: string, value: string): void { this.root.importPresentation(name, value); }
  clone(): SvgDocument {
    const copy = new SvgDocument(this.width, this.height); copy.root = this.root.clone(); return copy;
  }
  all(): readonly Shape[] {
    const nodes: Shape[] = [];
    const visit = (node: Shape): void => { nodes.push(node); node.children.forEach(visit); };
    this.root.children.forEach(visit); return nodes;
  }
  find(id: string): Shape { return this.location(id).shape; }
  parentLabel(id: string): string {
    const parent = this.location(id).parent; return parent === this.root ? 'svg' : parent.label;
  }
  add(shape: Shape, parentId?: string): void {
    const parent = parentId === undefined ? this.root : this.container(parentId);
    const seen = new Set(this.all().map(node => node.id));
    const check = (node: Shape): void => {
      if (seen.has(node.id)) throw new EditorError(`id already exists: ${node.id}`);
      seen.add(node.id); node.children.forEach(check);
    };
    check(shape); parent.insert(shape);
  }
  delete(id: string): string {
    const { shape, parent } = this.location(id); parent.remove(shape); return shape.label;
  }
  group(newId: string, ids: readonly string[]): Group {
    if (this.all().some(node => node.id === newId)) throw new EditorError(`id already exists: ${newId}`);
    if (!ids.length) throw new EditorError('group requires at least one shape');
    if (new Set(ids).size !== ids.length) throw new EditorError('duplicate group member');
    const selected = ids.map(id => this.location(id));
    const selectedIds = new Set(ids);
    const hasSelectedDescendant = (shape: Shape): boolean => shape.children.some(child => selectedIds.has(child.id) || hasSelectedDescendant(child));
    for (const { shape } of selected) {
      if (hasSelectedDescendant(shape)) throw new EditorError(`cannot group a container into its own descendant: ${shape.id}`);
    }
    const order = this.all(); selected.sort((a, b) => order.indexOf(a.shape) - order.indexOf(b.shape));
    const first = selected[0]!;
    const sameParent = selected.every(item => item.parent === first.parent);
    const parent = sameParent ? first.parent : this.root;
    const branchIndex = this.root.children.findIndex(branch => branch === first.shape || this.descendants(branch).includes(first.shape));
    const index = sameParent ? first.index : branchIndex;
    const group = new Group(newId);
    for (const item of selected) { item.parent.remove(item.shape); group.insert(item.shape); }
    parent.insert(group, index); return group;
  }
  ungroup(id: string): number {
    const { shape, parent, index } = this.location(id);
    if (!(shape instanceof Group)) throw new EditorError(`not a container: ${id}`);
    if (parent === this.root) throw new EditorError(`cannot ungroup top-level container: ${id}`);
    const children = shape.children;
    parent.remove(shape);
    children.forEach((child, offset) => { shape.remove(child); parent.insert(child, index + offset); });
    return children.length;
  }
  addTo(groupId: string, id: string): void {
    const target = this.container(groupId);
    const source = this.location(id);
    if (source.shape === target || this.descendants(source.shape).includes(target)) {
      throw new EditorError(`cannot move a container into its own descendant: ${id}`);
    }
    source.parent.remove(source.shape); target.insert(source.shape);
  }
  reorder(id: string, front: boolean): void {
    const { shape, parent } = this.location(id); parent.remove(shape);
    parent.insert(shape, front ? parent.children.length : 0);
  }
  private container(id: string): Group {
    const shape = this.all().find(node => node.id === id);
    if (!shape) throw new EditorError(`no such container: ${id}`);
    if (!(shape instanceof Group)) throw new EditorError(`not a container: ${id}`);
    return shape;
  }
  private location(id: string): Location {
    const visit = (parent: Group): Location | undefined => {
      for (const [index, shape] of parent.children.entries()) {
        if (shape.id === id) return { shape, parent, index };
        if (shape instanceof Group) { const found = visit(shape); if (found) return found; }
      }
      return undefined;
    };
    const found = visit(this.root);
    if (!found) throw new EditorError(`no such shape: ${id}`);
    return found;
  }
  private descendants(shape: Shape): Shape[] {
    return shape.children.flatMap(child => [child, ...this.descendants(child)]);
  }
}
