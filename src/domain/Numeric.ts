import { EditorError } from './errors/EditorError.js';

export class Numeric {
  static parse(value: string, label = 'number'): number {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) {
      throw new EditorError(`invalid ${label}: ${value}`);
    }
    return this.finite(Number(value), label);
  }
  static finite(value: number, label = 'number'): number {
    if (!Number.isFinite(value)) throw new EditorError(`invalid ${label}: ${value}`);
    return Object.is(value, -0) ? 0 : value;
  }
  static nonnegative(value: number, label: string): number {
    this.finite(value, label);
    if (value < 0) throw new EditorError(`${label} must be nonnegative`);
    return value;
  }
  static positive(value: number, label: string): number {
    this.finite(value, label);
    if (value <= 0) throw new EditorError(`${label} must be positive`);
    return value;
  }
  static length(value: string, label: string): number {
    return this.parse(value.replace(/px$/, ''), label);
  }
  static format(value: number): string { return String(Object.is(value, -0) ? 0 : value); }
}
