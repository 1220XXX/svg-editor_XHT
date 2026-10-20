import { UniformTransform } from '../../domain/UniformTransform.js';
import { Numeric } from '../../domain/Numeric.js';
import { TransformSyntax } from './TransformSyntax.js';

export class TranslationSyntax extends TransformSyntax {
  private readonly pattern = new RegExp(`^translate\\(\\s*(${this.number})(?:(?:\\s*,\\s*|\\s+)(${this.number}))?\\s*\\)`);
  override match(source: string): { transform: UniformTransform; length: number } | undefined {
    const match = this.pattern.exec(source);
    if (!match) return undefined;
    return { transform: new UniformTransform(1, Numeric.parse(match[1]!), Numeric.parse(match[2] ?? '0')), length: match[0].length };
  }
}
