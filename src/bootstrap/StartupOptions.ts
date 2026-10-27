export class StartupOptions {
  private readonly preserving: boolean;
  constructor(args: readonly string[]) {
    for (const argument of args) {
      if (argument !== '--preserve-style') throw new Error(`unknown option: ${argument}`);
    }
    this.preserving = args.includes('--preserve-style');
  }
  get preserveStyle(): boolean { return this.preserving; }
}
