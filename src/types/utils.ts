/* eslint-disable @typescript-eslint/no-explicit-any */
export type LiteralArrayOf<TArrayLike> = TArrayLike extends any
  ? TArrayLike extends (infer TLiteral)[]
    ? TLiteral[]
    : never
  : never;

export type Schema<TSchema extends Record<string, any>> = TSchema & {
  /**
   * A JSON Schema URI that describes the structure of this configuration object
   */
  $schema?: string;
};
