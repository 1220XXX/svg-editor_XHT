import { UniformTransform } from '../../domain/UniformTransform.js';
import { EditorError } from '../../domain/errors/EditorError.js';
import type { TransformSyntax } from './TransformSyntax.js';
import { TranslationSyntax } from './TranslationSyntax.js';
import { ScaleSyntax } from './ScaleSyntax.js';

export class TransformParser {
  // Polymorphic grammar matchers, rather than another name-to-implementation registry.
  private readonly syntaxes: readonly TransformSyntax[] = [new TranslationSyntax(), new ScaleSyntax()];
  parse(source: string): UniformTransform {
    let transform = new UniformTransform(); let remaining = source.trim();
    while (remaining) {
      const matched = this.syntaxes.map(syntax => syntax.match(remaining)).find(result => result !== undefined);
      if (!matched) throw new EditorError(`unsupported or invalid SVG transform: ${source}`);
      transform = transform.compose(matched.transform);
      remaining = remaining.slice(matched.length).trimStart();
      if (remaining.startsWith(',')) {
        remaining = remaining.slice(1).trimStart();
        if (!remaining) throw new EditorError(`invalid SVG transform: ${source}`);
      }
    }
    return transform;
  }
}
