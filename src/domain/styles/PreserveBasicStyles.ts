import { EditorError } from '../errors/EditorError.js';
import type { Shape } from '../shapes/Shape.js';
import type { ReparentingStylePolicy, StylePatch } from './ReparentingStylePolicy.js';
import { StyleResolver } from './StyleResolver.js';
import { BasicPaint } from './BasicPaint.js';

export class PreserveBasicStyles implements ReparentingStylePolicy {
  private readonly resolver = new StyleResolver();
  prepare(shape: Shape, previousAncestors: readonly Shape[], nextAncestors: readonly Shape[]): readonly StylePatch[] {
    const opacity = (ancestors: readonly Shape[]): readonly Shape[] => ancestors.filter(node =>
      node.attributes.opacity !== undefined && Number(node.attributes.opacity) !== 1);
    const previousOpacity = opacity(previousAncestors), nextOpacity = opacity(nextAncestors);
    if (previousOpacity.length !== nextOpacity.length || previousOpacity.some((node, index) => node !== nextOpacity[index])) {
      throw new EditorError('cannot preserve style: group opacity context would change');
    }
    const patches: StylePatch[] = [];
    const visit = (node: Shape, previous: Readonly<Record<string, string>>, next: Readonly<Record<string, string>>): void => {
      const before = this.resolver.resolve(node, previous), after = this.resolver.resolve(node, next);
      for (const name of this.resolver.extended) {
        if (before[name] !== after[name]) throw new EditorError(`cannot preserve style: inherited ${name} would change on ${node.label}`);
      }
      for (const name of this.resolver.basic) {
        const value = before[name]!;
        if (name !== 'stroke-width' && !BasicPaint.supports(value)) {
          throw new EditorError(`cannot preserve style: unsupported ${name} paint on ${node.label}`);
        }
        if (value !== after[name]) { patches.push({ shape: node, attribute: name, value }); after[name] = value; }
      }
      node.children.forEach(child => visit(child, before, after));
    };
    visit(shape, this.resolver.context(previousAncestors), this.resolver.context(nextAncestors));
    return patches;
  }
}
