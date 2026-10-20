import { EditorError } from '../../domain/errors/EditorError.js';
import { Numeric } from '../../domain/Numeric.js';
import type { Argument } from '../Argument.js';

export class CommandArguments {
  constructor(private readonly tokens: readonly Argument[]) {}
  get length(): number { return this.tokens.length; }
  expect(min: number, max = min): void {
    if (this.length < min || this.length > max) throw new EditorError('invalid arguments. use help for syntax');
  }
  value(index: number): string {
    const token = this.tokens[index];
    if (!token) throw new EditorError('missing argument. use help for syntax');
    return token.value;
  }
  number(index: number, label: string): number { return Numeric.parse(this.value(index), label); }
  values(start = 0, end = this.length): string[] { return this.tokens.slice(start, end).map(token => token.value); }
  keyword(index: number, value: string): boolean { return this.tokens[index]?.isKeyword(value) ?? false; }
}
