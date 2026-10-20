import type { UniformTransform } from '../../domain/UniformTransform.js';

export abstract class TransformSyntax {
  protected readonly number = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`;
  abstract match(source: string): { transform: UniformTransform; length: number } | undefined;
}
