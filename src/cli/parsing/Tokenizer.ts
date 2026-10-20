import { Argument } from '../../application/Argument.js';

export class Tokenizer {
  parse(line: string): readonly Argument[] {
    if (!line.trim() || line.trimStart().startsWith('#')) return [];
    const tokens: Argument[] = [];
    let value = '', quoted = false, inQuote = false, started = false;
    for (let index = 0; index < line.length; index++) {
      const char = line[index]!;
      if (char === '"') { inQuote = !inQuote; quoted = true; started = true; continue; }
      if (inQuote && char === '\\' && ['"', '\\'].includes(line[index + 1] ?? '')) {
        value += line[++index]!; continue;
      }
      if (!inQuote && /\s/.test(char)) {
        if (started) tokens.push(new Argument(value, quoted));
        value = ''; quoted = false; started = false; continue;
      }
      value += char; started = true;
    }
    if (inQuote) throw new Error('unterminated double quote');
    if (started) tokens.push(new Argument(value, quoted));
    return tokens;
  }
}
