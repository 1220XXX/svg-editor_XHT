import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, basename, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { TextStorage } from '../../application/ports/TextStorage.js';
import { EditorError } from '../../domain/errors/EditorError.js';

export class LocalTextStorage implements TextStorage {
  async read(path: string): Promise<string> {
    try { return await readFile(path, 'utf8'); }
    catch { throw new EditorError(`cannot read file: ${path}`); }
  }
  async write(path: string, content: string): Promise<void> {
    const target = resolve(path);
    const temporary = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, content, { flag: 'wx' });
      await rename(temporary, target);
    } catch { throw new EditorError(`cannot write file: ${path}`); }
    finally { await unlink(temporary).catch(() => undefined); }
  }
}
