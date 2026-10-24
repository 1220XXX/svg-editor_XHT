import type { Shape } from '../shapes/Shape.js';

export interface StylePatch {
  readonly shape: Shape;
  readonly attribute: string;
  readonly value: string;
}

export interface ReparentingStylePolicy {
  prepare(shape: Shape, previousAncestors: readonly Shape[], nextAncestors: readonly Shape[]): readonly StylePatch[];
}
