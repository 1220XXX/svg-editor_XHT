import { EditorError } from '../errors/EditorError.js';
import { Numeric } from '../Numeric.js';

export abstract class Shape {
  private readonly styles = new Map<string, string>();
  private readonly metadata = new Map<string, string>();
  protected constructor(private readonly shapeId: string) {
    if (!shapeId || /[\s"'<>/=]/.test(shapeId)) throw new EditorError(`invalid id: ${shapeId}`);
  }
  get id(): string { return this.shapeId; }
  abstract get type(): string;
  get label(): string { return `${this.type}#${this.id}`; }
  get children(): readonly Shape[] { return []; }
  get content(): string | undefined { return undefined; }
  abstract move(dx: number, dy: number): void;
  abstract scale(factor: number): void;
  abstract clone(): Shape;
  abstract summary(): string;
  get attributes(): Readonly<Record<string, string>> {
    return { id: this.id, ...Object.fromEntries(this.styles), ...Object.fromEntries(this.metadata) };
  }
  set(attribute: string, value: string): void {
    if (!['fill', 'stroke', 'stroke-width'].includes(attribute)) {
      throw new EditorError(`unknown attribute: ${attribute}`);
    }
    this.importPresentation(attribute, value);
  }
  importPresentation(attribute: string, value: string): void {
    const allowed = ['fill', 'stroke', 'stroke-width', 'font-size', 'text-anchor',
      'font-family', 'font-weight', 'opacity', 'fill-opacity', 'stroke-opacity'];
    if (!allowed.includes(attribute)) throw new EditorError(`unsupported SVG attribute: ${attribute}`);
    if (!value) throw new EditorError(`invalid ${attribute}: ${value}`);
    if (['stroke-width', 'font-size', 'opacity', 'fill-opacity', 'stroke-opacity'].includes(attribute)) {
      const number = Numeric.nonnegative(Numeric.length(value, attribute), attribute);
      if (attribute.endsWith('opacity') && number > 1) throw new EditorError(`${attribute} must be between 0 and 1`);
      value = Numeric.format(number);
    }
    this.styles.set(attribute, value);
  }
  importMetadata(attribute: string, value: string): void {
    if (!attribute.startsWith('data-')) throw new EditorError(`unsupported SVG attribute: ${attribute}`);
    this.metadata.set(attribute, value);
  }
  protected copyPresentationTo(target: Shape): void {
    for (const [name, value] of this.styles) target.importPresentation(name, value);
    for (const [name, value] of this.metadata) target.importMetadata(name, value);
  }
  protected styleSummary(): string {
    return [...this.styles].map(([name, value]) => ` ${name}=${value}`).join('');
  }
}
