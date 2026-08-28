import duration from "pretty-ms";

export class Duration {
  static format(ms: number): string {
    return duration(ms, {
      colonNotation: true,
      secondsDecimalDigits: 0,
      millisecondsDecimalDigits: 0,
    });
  }
}
