export class Argument {
  constructor(private readonly text: string, private readonly quoted = false) {}
  get value(): string { return this.text; }
  isKeyword(keyword: string): boolean { return !this.quoted && this.text === keyword; }
}
