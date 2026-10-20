import type { SvgDocument } from '../../domain/SvgDocument.js';
import type { DocumentMemento } from '../history/DocumentMemento.js';

export interface ReversibleEdit {
  apply(document: SvgDocument): string;
  remember(before: DocumentMemento, after: DocumentMemento, result: string): void;
  undo(): { document: SvgDocument; message: string };
  redo(): { document: SvgDocument; message: string };
}
