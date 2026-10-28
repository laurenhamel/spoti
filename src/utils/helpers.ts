import { mergeWith, isArray } from "lodash-es";

export function mergeAndConcat<TType extends object>(
  source: TType,
  patch: Partial<TType>
): TType {
  return mergeWith(source, patch, (a, b) => {
    if (isArray(a)) return a.concat(b);
  });
}

export function sortByKeys<TType extends object>(object: TType): TType {
  const keys = Object.keys(object).sort();

  return keys.reduce(
    (result, key) => ({ ...result, [key]: object[key as keyof typeof object] }),
    {} as TType
  );
}
