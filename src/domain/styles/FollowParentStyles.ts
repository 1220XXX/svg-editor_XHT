import type { Shape } from '../shapes/Shape.js';
import type { ReparentingStylePolicy, StylePatch } from './ReparentingStylePolicy.js';

export class FollowParentStyles implements ReparentingStylePolicy {
  prepare(_shape: Shape, _previousAncestors: readonly Shape[], _nextAncestors: readonly Shape[]): readonly StylePatch[] { return []; }
}
