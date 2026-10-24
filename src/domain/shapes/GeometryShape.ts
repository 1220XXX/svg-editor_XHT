import { Numeric } from '../Numeric.js';
import { Shape } from './Shape.js';

export abstract class GeometryShape extends Shape {
  private readonly geometry: Map<string, number>;
  protected constructor(id: string, values: Record<string, number>,
    private readonly xAttributes: readonly string[], private readonly yAttributes: readonly string[],
    private readonly nonnegative: readonly string[] = []) {
    super(id);
    this.geometry = new Map(Object.entries(values));
    for (const [name, value] of this.geometry) this.validate(name, value);
  }
  protected value(name: string): number { return this.geometry.get(name)!; }
  override get geometryAttributes(): Readonly<Record<string, string>> {
    return Object.fromEntries([...this.geometry].map(([key, value]) => [key, Numeric.format(value)]));
  }
  override get attributes(): Readonly<Record<string, string>> {
    return { ...super.attributes, ...this.geometryAttributes };
  }
  override move(dx: number, dy: number): void {
    Numeric.finite(dx, 'dx'); Numeric.finite(dy, 'dy');
    const next = new Map(this.geometry);
    for (const name of this.xAttributes) next.set(name, Numeric.finite(this.value(name) + dx));
    for (const name of this.yAttributes) next.set(name, Numeric.finite(this.value(name) + dy));
    for (const [name, value] of next) this.geometry.set(name, value);
  }
  override scale(factor: number): void {
    Numeric.positive(factor, 'scale factor');
    const next = [...this.geometry].map(([name, value]) => [name, this.validate(name, value * factor)] as const);
    for (const [name, value] of next) this.geometry.set(name, value);
  }
  override set(attribute: string, value: string): void {
    if (!this.geometry.has(attribute)) { super.set(attribute, value); return; }
    this.geometry.set(attribute, this.validate(attribute, Numeric.parse(value, attribute)));
  }
  private validate(name: string, value: number): number {
    return this.nonnegative.includes(name) ? Numeric.nonnegative(value, name) : Numeric.finite(value, name);
  }
}
