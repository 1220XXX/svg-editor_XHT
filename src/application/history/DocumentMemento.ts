import type { SvgDocument } from '../../domain/SvgDocument.js';

export class DocumentMemento {
  private readonly snapshot: SvgDocument;
  constructor(document: SvgDocument) { this.snapshot = document.clone(); }
  restore(): SvgDocument { return this.snapshot.clone(); }
}
