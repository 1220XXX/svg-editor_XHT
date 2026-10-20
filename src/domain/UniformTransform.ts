import { Numeric } from './Numeric.js';

/** Immutable affine transform: p' = scale * p + translation. */
export class UniformTransform {
  constructor(private readonly scaleValue = 1, private readonly x = 0, private readonly y = 0) {
    Numeric.positive(scaleValue, 'transform scale'); Numeric.finite(x); Numeric.finite(y);
  }
  get factor(): number { return this.scaleValue; }
  get dx(): number { return this.x; }
  get dy(): number { return this.y; }
  compose(local: UniformTransform): UniformTransform {
    return new UniformTransform(this.factor * local.factor, this.factor * local.dx + this.dx,
      this.factor * local.dy + this.dy);
  }
}
