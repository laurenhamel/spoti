import { mergeWith, isArray } from "lodash-es";

export function mergeAndConcat<TType extends object>(
  source: TType,
  patch: Partial<TType>
): TType {
  return mergeWith(source, patch, (a, b) => {
    if (isArray(a)) return a.concat(b);
  });
}
