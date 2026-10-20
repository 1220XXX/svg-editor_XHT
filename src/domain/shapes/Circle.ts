import { GeometryShape } from './GeometryShape.js';

export class Circle extends GeometryShape {
  constructor(id: string, cx: number, cy: number, r: number) {
    super(id, { cx, cy, r }, ["cx"], ["cy"], ["r"]);
  }
  override get type(): string { return 'circle'; }
  override clone(): Circle {
    const copy = new Circle(this.id, this.value('cx'), this.value('cy'), this.value('r'));
    this.copyPresentationTo(copy); return copy;
  }
  override summary(): string { return `${this.label}  ${`cx=${this.value('cx')} cy=${this.value('cy')} r=${this.value('r')}`}${this.styleSummary()}`; }
}
