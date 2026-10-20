import { UniformTransform } from '../../domain/UniformTransform.js';
import { Numeric } from '../../domain/Numeric.js';
import { EditorError } from '../../domain/errors/EditorError.js';
import { TransformSyntax } from './TransformSyntax.js';

export class ScaleSyntax extends TransformSyntax {
  private readonly pattern = new RegExp(`^scale\\(\\s*(${this.number})(?:(?:\\s*,\\s*|\\s+)(${this.number}))?\\s*\\)`);
  override match(source: string): { transform: UniformTransform; length: number } | undefined {
    const match = this.pattern.exec(source);
    if (!match) return undefined;
    const factor = Numeric.parse(match[1]!);
    if (match[2] !== undefined && Numeric.parse(match[2]) !== factor) {
      throw new EditorError('unsupported SVG transform: nonuniform scale');
    }
    return { transform: new UniformTransform(factor), length: match[0].length };
  }
}
