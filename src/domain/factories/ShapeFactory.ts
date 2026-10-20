import { EditorError } from '../errors/EditorError.js';
import { Numeric } from '../Numeric.js';
import { Shape } from '../shapes/Shape.js';
import { Rect } from '../shapes/Rect.js';
import { Circle } from '../shapes/Circle.js';
import { Ellipse } from '../shapes/Ellipse.js';
import { Line } from '../shapes/Line.js';
import { Text } from '../shapes/Text.js';
import { Group } from '../shapes/Group.js';

type Definition = {
  readonly keys: readonly string[];
  readonly create: (id: string, numbers: number[], text: string) => Shape;
  readonly paint?: string;
  readonly text?: boolean;
};

export class ShapeFactory {
  // The only shape-name dispatch point; replace with providers in the plugin phase.
  private readonly definitions = new Map<string, Definition>([
    ['rect', { keys: ['x', 'y', 'width', 'height'], paint: 'fill', create: (id, v) => new Rect(id, v[0]!, v[1]!, v[2]!, v[3]!) }],
    ['circle', { keys: ['cx', 'cy', 'r'], paint: 'fill', create: (id, v) => new Circle(id, v[0]!, v[1]!, v[2]!) }],
    ['ellipse', { keys: ['cx', 'cy', 'rx', 'ry'], paint: 'fill', create: (id, v) => new Ellipse(id, v[0]!, v[1]!, v[2]!, v[3]!) }],
    ['line', { keys: ['x1', 'y1', 'x2', 'y2'], paint: 'stroke', create: (id, v) => new Line(id, v[0]!, v[1]!, v[2]!, v[3]!) }],
    ['text', { keys: ['x', 'y'], text: true, create: (id, v, text) => new Text(id, v[0]!, v[1]!, text) }],
    ['g', { keys: [], create: id => new Group(id) }],
  ]);
  help(): readonly string[] {
    return [...this.definitions].map(([type, definition]) =>
      `create ${type} <id>${definition.keys.map(key => ` <${key}>`).join('')}${definition.text ? ' "content"' : ''}${definition.paint ? ` [${definition.paint}]` : ''} [in <containerId>]`);
  }
  create(type: string, id: string, args: readonly string[]): Shape {
    const definition = this.definition(type);
    const count = definition.keys.length + (definition.text ? 1 : 0);
    if (args.length < count || args.length > count + (definition.paint ? 1 : 0)) {
      throw new EditorError(`invalid arguments for create ${type}`);
    }
    const numbers = definition.keys.map((key, index) => Numeric.parse(args[index]!, key));
    const shape = definition.create(id, numbers, definition.text ? args[count - 1]! : '');
    if (definition.paint && args.length > count) shape.set(definition.paint, args[count]!);
    return shape;
  }
  read(type: string, id: string, attributes: Readonly<Record<string, string>>, content: string): Shape {
    const definition = this.definition(type);
    const values = definition.keys.map(key => Numeric.length(attributes[key] ?? '0', key));
    const shape = definition.create(id, values, content);
    for (const [name, value] of Object.entries(attributes)) {
      if (name === 'id' || definition.keys.includes(name)) continue;
      if (name.startsWith('data-')) shape.importMetadata(name, value);
      else shape.importPresentation(name, value);
    }
    return shape;
  }
  private definition(type: string): Definition {
    const definition = this.definitions.get(type);
    if (!definition) throw new EditorError(`unknown shape type: ${type} (is the plugin loaded?)`);
    return definition;
  }
}
