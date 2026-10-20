import { Numeric } from '../Numeric.js';
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
  override normalizePresentationScale(factor: number, inherited: Readonly<Record<string, string>>): void {
    super.normalizePresentationScale(factor, inherited);
    if (factor === 1) return;
    const fontSize = Numeric.length(inherited['font-size'] ?? '16', 'font-size');
    this.importPresentation('font-size', Numeric.format(Numeric.finite(fontSize * factor)));
  }
  override clone(): Text {
    const copy = new Text(this.id, this.value('x'), this.value('y'), this.text);
    this.copyPresentationTo(copy); return copy;
  }
  override summary(): string {
    return `${this.label}  (${this.value('x')},${this.value('y')}) ${JSON.stringify(this.text)}${this.styleSummary()}`;
  }
}
