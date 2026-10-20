import { SvgDocument } from '../domain/SvgDocument.js';
import { EditorError } from '../domain/errors/EditorError.js';
import { ShapeFactory } from '../domain/factories/ShapeFactory.js';
import type { Shape } from '../domain/shapes/Shape.js';
import type { Command } from './commands/Command.js';
import type { ReversibleEdit } from './ports/ReversibleEdit.js';
import type { CommandContext } from './ports/CommandContext.js';
import { HistoryManager } from './history/HistoryManager.js';
import { DocumentMemento } from './history/DocumentMemento.js';
import type { TextStorage } from './ports/TextStorage.js';
import type { DocumentCodec } from './ports/DocumentCodec.js';
import type { TreeNode } from './TreeNode.js';

export class EditorSession implements CommandContext {
  private document: SvgDocument | undefined;
  private filePath: string | undefined;
  private readonly history = new HistoryManager();
  constructor(readonly factory = new ShapeFactory(), private readonly storage?: TextStorage, private readonly codec?: DocumentCodec) {}
  async execute(command: Command): Promise<readonly string[]> {
    if (command.requiresDocument) this.current();
    return command.execute(this);
  }
  init(width: number, height: number): string {
    const document = new SvgDocument(width, height);
    this.document = document; this.filePath = undefined; this.history.barrier();
    return `canvas ${width}x${height} created`;
  }
  canvas(width?: number, height?: number): string {
    if (width === undefined || height === undefined) return `canvas ${this.current().width}x${this.current().height}`;
    const document = this.current().clone(); document.resize(width, height);
    this.document = document; this.history.barrier(); return `canvas resized to ${width}x${height}`;
  }
  edit(command: ReversibleEdit): string {
    const before = new DocumentMemento(this.current());
    const working = before.restore();
    const result = command.apply(working);
    const after = new DocumentMemento(working);
    command.remember(before, after, result); this.document = working; this.history.record(command);
    return result;
  }
  undo(): string { const result = this.history.undo(); this.document = result.document; return result.message; }
  redo(): string { const result = this.history.redo(); this.document = result.document; return result.message; }
  tree(id?: string): TreeNode {
    const node = (shape: Shape): TreeNode => ({ summary: shape.summary(), children: shape.children.map(node) });
    const document = this.current();
    return id === undefined ? { summary: `svg (${document.width}x${document.height})`, children: document.children.map(node) } : node(document.find(id));
  }
  show(id: string): readonly string[] {
    const document = this.current(); const shape = document.find(id);
    const { id: _id, ...attributes } = shape.attributes;
    const entries = Object.entries(attributes).map(([name, value]) => `  ${name}=${value}`);
    if (shape.content !== undefined) entries.push(`  text=${JSON.stringify(shape.content)}`);
    return [`${shape.label}  parent=${document.parentLabel(id)}`, ...entries];
  }
  async read(path: string): Promise<readonly string[]> {
    if (!this.storage || !this.codec) throw new EditorError('SVG IO is not configured');
    const content = await this.storage.read(path);
    const { document, warnings } = this.codec.decode(content);
    this.document = document; this.filePath = path; this.history.barrier();
    return [...warnings, `read ${path} (${document.size} elements)`];
  }
  async save(path?: string): Promise<string> {
    const document = this.current(); const target = path ?? this.filePath;
    if (!target) throw new EditorError('no file path. use save <file.svg>');
    if (!this.storage || !this.codec) throw new EditorError('SVG IO is not configured');
    const content = this.codec.encode(document);
    await this.storage.write(target, content);
    this.filePath = target; this.history.barrier(); return `saved to ${target} (${document.size} elements)`;
  }
  private current(): SvgDocument {
    if (!this.document) throw new EditorError("no document. use 'init' or 'read' first");
    return this.document;
  }
}
