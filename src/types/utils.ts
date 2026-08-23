/* eslint-disable @typescript-eslint/no-explicit-any */
export type LiteralArrayOf<TArrayLike> = TArrayLike extends any
  ? TArrayLike extends (infer TLiteral)[]
    ? TLiteral[]
    : never
  : never;
