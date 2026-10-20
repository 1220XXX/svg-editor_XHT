import { GeometryShape } from './GeometryShape.js';

export class Text extends GeometryShape {
  constructor(id: string, x: number, y: number, private text: string) {
    super(id, { x, y }, ['x'], ['y']);
  }
  override get type(): string { return 'text'; }
  override get content(): string { return this.text; }
  override set(attribute: string, value: string): void {
    if (attribute === 'text') { this.text = value; return; }
    super.set(attribute, value);
  }
  override clone(): Text {
    const copy = new Text(this.id, this.value('x'), this.value('y'), this.text);
    this.copyPresentationTo(copy); return copy;
  }
  override summary(): string {
    return `${this.label}  (${this.value('x')},${this.value('y')}) ${JSON.stringify(this.text)}${this.styleSummary()}`;
  }
}
