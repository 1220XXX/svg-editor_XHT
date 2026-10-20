import type { SvgDocument } from '../../domain/SvgDocument.js';

export interface DocumentCodec {
  decode(content: string): { document: SvgDocument; warnings: readonly string[] };
  encode(document: SvgDocument): string;
}
