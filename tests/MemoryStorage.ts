import type { TextStorage } from '../src/application/ports/TextStorage.js';
import { EditorError } from '../src/domain/errors/EditorError.js';

export class MemoryStorage implements TextStorage {
  private readonly files = new Map<string, string>();
  private writable = true;
  put(path: string, content: string): void { this.files.set(path, content); }
  denyWrites(): void { this.writable = false; }
  async read(path: string): Promise<string> {
    const value = this.files.get(path);
    if (value === undefined) throw new EditorError(`cannot read file: ${path}`);
    return value;
  }
  async write(path: string, content: string): Promise<void> {
    if (!this.writable) throw new EditorError(`cannot write file: ${path}`);
    this.files.set(path, content);
  }
}
