import { EditorError } from '../../domain/errors/EditorError.js';
import type { SvgDocument } from '../../domain/SvgDocument.js';
import type { ReversibleEdit } from '../ports/ReversibleEdit.js';

export class HistoryManager {
  private readonly past: ReversibleEdit[] = [];
  private readonly future: ReversibleEdit[] = [];
  private blocked = false;
  record(command: ReversibleEdit): void {
    this.past.push(command); this.future.length = 0; this.blocked = false;
  }
  barrier(): void { this.past.length = 0; this.future.length = 0; this.blocked = true; }
  undo(): { document: SvgDocument; message: string } {
    this.check();
    const command = this.past.at(-1);
    if (!command) throw new EditorError('nothing to undo');
    const restored = command.undo(); this.past.pop(); this.future.push(command); return restored;
  }
  redo(): { document: SvgDocument; message: string } {
    this.check();
    const command = this.future.at(-1);
    if (!command) throw new EditorError('nothing to redo');
    const restored = command.redo(); this.future.pop(); this.past.push(command); return restored;
  }
  private check(): void { if (this.blocked) throw new EditorError('undo not allowed after io command'); }
}
