import { DOMParser, DOMImplementation, XMLSerializer } from '@xmldom/xmldom';
import type { Element, Document as XmlDocument } from '@xmldom/xmldom';
import type { DocumentCodec } from '../../application/ports/DocumentCodec.js';
import { SvgDocument } from '../../domain/SvgDocument.js';
import { ShapeFactory } from '../../domain/factories/ShapeFactory.js';
import { Shape } from '../../domain/shapes/Shape.js';
import { Group } from '../../domain/shapes/Group.js';
import { Numeric } from '../../domain/Numeric.js';
import { EditorError } from '../../domain/errors/EditorError.js';

export class SvgCodec implements DocumentCodec {
  private readonly namespace = 'http://www.w3.org/2000/svg';
  constructor(private readonly factory: ShapeFactory) {}
  decode(content: string): { document: SvgDocument; warnings: readonly string[] } {
    let xml: XmlDocument;
    try {
      xml = new DOMParser({ onError: (_level, message) => { throw new Error(message); } })
        .parseFromString(content, 'application/xml');
    } catch { throw new EditorError('invalid SVG: malformed XML'); }
    if (xml.doctype) throw new EditorError('unsupported SVG: DOCTYPE');
    const root = xml.documentElement;
    if (!root || root.localName !== 'svg') throw new EditorError('invalid SVG: expected <svg> root');
    this.checkNamespace(root);
    const width = Numeric.length(root.getAttribute('width') ?? '800', 'canvas width');
    const height = Numeric.length(root.getAttribute('height') ?? '600', 'canvas height');
    const document = new SvgDocument(width, height);
    const rootAttributes = this.attributes(root);
    for (const [name, value] of Object.entries(rootAttributes)) {
      if (['width', 'height', 'viewBox'].includes(name)) continue;
      document.importPresentation(name, value);
    }
    if (root.hasAttribute('viewBox')) {
      const values = root.getAttribute('viewBox')!.trim().split(/[\s,]+/).map(v => Numeric.parse(v, 'viewBox'));
      if (values.length !== 4 || values[0] !== 0 || values[1] !== 0 || values[2] !== width || values[3] !== height) {
        throw new EditorError('unsupported SVG viewBox: expected 0 0 width height');
      }
    }
    const used = new Set<string>();
    const collect = (element: Element): void => {
      this.checkNamespace(element);
      const id = element.getAttribute('id');
      if (id) {
        if (used.has(id)) throw new EditorError(`id already exists: ${id}`);
        used.add(id);
      }
      this.elements(element).forEach(collect);
    };
    this.elements(root).forEach(collect);
    const counters = new Map<string, number>();
    const warnings: string[] = [];
    const build = (element: Element): Shape => {
      const type = element.localName ?? element.tagName;
      const attributes = this.attributes(element);
      let id = attributes.id;
      if (!id) {
        let counter = counters.get(type) ?? 0;
        do { id = `${type}${++counter}`; } while (used.has(id));
        counters.set(type, counter); used.add(id);
        warnings.push(`warning: assigned id ${id} to unnamed <${type}>`);
      }
      if (attributes.transform?.trim()) throw new EditorError('unsupported SVG attribute: transform');
      delete attributes.transform;
      const shape = this.factory.read(type, id, attributes, element.textContent ?? '');
      const children = this.elements(element);
      if (shape instanceof Group) children.forEach(child => shape.insert(build(child)));
      else if (children.length) throw new EditorError(`unsupported child element in <${type}>`);
      if (shape.content === undefined && this.directText(element).trim()) {
        throw new EditorError(`unexpected text in <${type}>`);
      }
      return shape;
    };
    if (this.directText(root).trim()) throw new EditorError('unexpected text in <svg>');
    this.elements(root).forEach(element => document.add(build(element)));
    return { document, warnings };
  }
  encode(document: SvgDocument): string {
    const xml = new DOMImplementation().createDocument(this.namespace, 'svg', null);
    const root = xml.documentElement!;
    root.setAttribute('xmlns', this.namespace);
    root.setAttribute('width', String(document.width)); root.setAttribute('height', String(document.height));
    root.setAttribute('viewBox', `0 0 ${document.width} ${document.height}`);
    for (const [name, value] of Object.entries(document.presentation)) root.setAttribute(name, value);
    const build = (shape: Shape, depth: number): Element => {
      const element = xml.createElementNS(this.namespace, shape.type);
      for (const [name, value] of Object.entries(shape.attributes)) element.setAttribute(name, value);
      if (shape.content !== undefined) element.appendChild(xml.createTextNode(shape.content));
      for (const child of shape.children) {
        element.appendChild(xml.createTextNode(`\n${'  '.repeat(depth + 1)}`));
        element.appendChild(build(child, depth + 1));
      }
      if (shape.children.length) element.appendChild(xml.createTextNode(`\n${'  '.repeat(depth)}`));
      return element;
    };
    for (const shape of document.children) {
      root.appendChild(xml.createTextNode('\n  ')); root.appendChild(build(shape, 1));
    }
    root.appendChild(xml.createTextNode('\n'));
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(xml)}\n`;
  }
  private attributes(element: Element): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attribute = element.attributes.item(i)!;
      if (attribute.name === 'xmlns' || attribute.prefix === 'xmlns') continue;
      if (attribute.prefix) throw new EditorError(`unsupported SVG attribute: ${attribute.name}`);
      result[attribute.name] = attribute.value;
    }
    return result;
  }
  private elements(element: Element): Element[] {
    const children: Element[] = [];
    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === child.ELEMENT_NODE) children.push(child as Element);
    }
    return children;
  }
  private directText(element: Element): string {
    let text = '';
    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === child.TEXT_NODE || child.nodeType === child.CDATA_SECTION_NODE) text += child.nodeValue;
    }
    return text;
  }
  private checkNamespace(element: Element): void {
    if (element.namespaceURI && element.namespaceURI !== this.namespace) throw new EditorError('unsupported SVG namespace');
  }
}
