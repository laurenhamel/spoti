export type LiteralArrayOf<TArrayLike> = TArrayLike extends any
  ? TArrayLike extends (infer TLiteral)[]
    ? TLiteral[]
    : never
  : never;
