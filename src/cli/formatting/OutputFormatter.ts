export class OutputFormatter {
  error(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return `error: ${message.replace(/[\r\n]+/g, ' ')}`;
  }
}
