import type { Shape } from '../shapes/Shape.js';

export class StyleResolver {
  private readonly basicNames = ['fill', 'stroke', 'stroke-width'];
  private readonly extendedNames = ['font-size', 'font-family', 'font-weight', 'text-anchor', 'fill-opacity', 'stroke-opacity'];
  private readonly defaults: Readonly<Record<string, string>> = {
    fill: 'black', stroke: 'none', 'stroke-width': '1',
    'font-size': '16', 'font-family': 'serif', 'font-weight': 'normal', 'text-anchor': 'start',
    'fill-opacity': '1', 'stroke-opacity': '1',
  };
  get basic(): readonly string[] { return [...this.basicNames]; }
  get extended(): readonly string[] { return [...this.extendedNames]; }
  initial(): Readonly<Record<string, string>> { return { ...this.defaults }; }
  resolve(shape: Shape, inherited: Readonly<Record<string, string>>): Record<string, string> {
    const result = { ...inherited };
    for (const name of [...this.basic, ...this.extended]) {
      const value = shape.attributes[name];
      if (value === undefined) continue;
      const keyword = value.trim().toLowerCase();
      if (keyword === 'inherit' || keyword === 'unset') continue;
      result[name] = keyword === 'initial' ? this.defaults[name]! : value;
    }
    return result;
  }
  context(ancestors: readonly Shape[]): Readonly<Record<string, string>> {
    return ancestors.reduce((styles, shape) => this.resolve(shape, styles), this.initial());
  }
}
