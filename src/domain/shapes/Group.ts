import { EditorError } from '../errors/EditorError.js';
import { Numeric } from '../Numeric.js';
import { Shape } from './Shape.js';

export class Group extends Shape {
  private readonly nodes: Shape[] = [];
  constructor(id: string) { super(id); }
  override get type(): string { return 'g'; }
  override get children(): readonly Shape[] { return [...this.nodes]; }
  insert(shape: Shape, index = this.nodes.length): void {
    if (shape === this || this.contains(shape, this)) throw new EditorError(`cannot move a container into its own descendant: ${shape.id}`);
    this.nodes.splice(index, 0, shape);
  }
  remove(shape: Shape): void {
    const index = this.nodes.indexOf(shape);
    if (index < 0) throw new EditorError(`no such shape: ${shape.id}`);
    this.nodes.splice(index, 1);
  }
  override move(dx: number, dy: number): void {
    Numeric.finite(dx, 'dx'); Numeric.finite(dy, 'dy');
    for (const shape of this.nodes) shape.move(dx, dy);
  }
  override scale(factor: number): void {
    Numeric.positive(factor, 'scale factor');
    for (const shape of this.nodes) shape.scale(factor);
  }
  override clone(): Group {
    const copy = new Group(this.id);
    this.copyPresentationTo(copy);
    for (const shape of this.nodes) copy.insert(shape.clone());
    return copy;
  }
  override summary(): string { return `${this.label}${this.styleSummary()}`; }
  private contains(root: Shape, target: Shape): boolean {
    return root.children.some(child => child === target || this.contains(child, target));
  }
}
