import size from "pretty-bytes";

/** @deprecated */
export class Size {
  static format(bytes: number): string {
    return size(bytes, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      space: false,
    });
  }
}
