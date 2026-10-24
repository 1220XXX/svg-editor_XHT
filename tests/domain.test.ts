import { describe, expect, it } from 'vitest';
import { SvgDocument } from '../src/domain/SvgDocument.js';
import { ShapeFactory } from '../src/domain/factories/ShapeFactory.js';
import { Group } from '../src/domain/shapes/Group.js';

const factory = new ShapeFactory();
describe('polymorphic shapes and document invariants', () => {
  it.each([{ ids: [] }, { ids: ['a'] }])('enforces the group member minimum in the domain ($ids)', ({ ids }) => {
    const doc = new SvgDocument(); doc.add(factory.create('rect', 'a', ['1','2','3','4']));
    expect(() => doc.group('pair', ids)).toThrow('group requires at least two shapes');
    expect(doc.size).toBe(1); expect(doc.parentLabel('a')).toBe('svg');
  });
  it.each([
    ['rect', ['1','2','3','4'], 'x', 'y'],
    ['circle', ['1','2','3'], 'cx', 'cy'],
    ['ellipse', ['1','2','3','4'], 'cx', 'cy'],
    ['line', ['1','2','3','4'], 'x1', 'y1'],
    ['text', ['1','2','开始'], 'x', 'y'],
  ])('moves and scales %s without changing presentation', (type, args, x, y) => {
    const shape = factory.create(type, 'a', args as string[]);
    shape.set('stroke-width', '2'); shape.move(10, 20); shape.scale(2);
    expect(shape.attributes[x as string]).toBe('22'); expect(shape.attributes[y as string]).toBe('44');
    expect(shape.attributes['stroke-width']).toBe('2');
    expect(shape.clone().attributes).toEqual(shape.attributes);
  });
  it('handles nested groups and independent clones', () => {
    const doc = new SvgDocument(); doc.add(new Group('g')); doc.add(new Group('nested'), 'g');
    doc.add(factory.create('rect', 'r', ['1','2','3','4']), 'nested');
    const clone = doc.clone(); clone.find('g').move(4, 5); clone.find('g').scale(2);
    expect(clone.find('r').attributes.x).toBe('10'); expect(doc.find('r').attributes.x).toBe('1');
  });
  it('does not expose mutable child arrays or attribute maps', () => {
    const group = new Group('g'); group.insert(factory.create('g','child',[]));
    (group.children as unknown[]).pop();
    const attrs = group.attributes as Record<string,string>; attrs.id = 'tampered';
    expect(group.children).toHaveLength(1); expect(group.id).toBe('g');
  });
  it('enforces unique case sensitive ids and a strict attribute whitelist', () => {
    const doc = new SvgDocument(); doc.add(new Group('g')); doc.add(new Group('G'));
    expect(() => doc.add(new Group('g'))).toThrow('id already exists: g');
    expect(() => doc.find('G').set('x', '1')).toThrow('unknown attribute: x');
    expect(() => factory.create('box','b',[])).toThrow('unknown shape type: box');
    expect(() => factory.create('rect','r',['0','0','-1','2'])).toThrow('width must be nonnegative');
    expect(() => doc.find('g').scale(0)).toThrow('scale factor must be positive');
  });
});
