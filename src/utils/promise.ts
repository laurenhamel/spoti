import { map } from "lodash-es";
import { sleep } from "./timing";

export class Deferred<TResponse = void> {
  promise: Promise<TResponse>;

  result: TResponse | undefined;

  // @ts-ignore Capturing callback of promise
  resolve: (value: TResponse | PromiseLike<TResponse>) => void;

  // @ts-ignore Capturing callback of promise
  reject: (value: TResponse | PromiseLike<TResponse>) => void;

  constructor() {
    this.promise = new Promise<TResponse>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    }).then((result) => {
      this.result = result as TResponse;
    }) as Promise<TResponse>;
  }
}

export function pool(
  max: number
): <TResponse>(
  callbacks: (() => Promise<TResponse>)[]
) => Promise<TResponse[]> {
  const slots = new Array(max).fill(null).map(() => new Deferred());

  return async <TResponse>(
    callbacks: (() => Promise<TResponse>)[]
  ): Promise<TResponse[]> => {
    const results = new Array(callbacks.length)
      .fill(null)
      .map(() => new Deferred<TResponse>());

    const prepared = callbacks.map((callback, index) => ({ callback, index }));
    const initial = prepared.slice(0, max);
    const rest = prepared.slice(max);

    const next =
      (slot: number) =>
      (response?: { result: TResponse; index: number }): Promise<any> => {
        if (response) {
          const deferred = results[response.index];
          deferred.resolve(response.result);
        }

        const item = rest.shift();

        if (item) {
          const { callback, index } = item;
          return callback().then((result) => next(slot)({ index, result }));
        }

        return Promise.resolve();
      };

    for (let i = 0; i < slots.length; i++) {
      const { promise, resolve } = slots[i];
      const item = initial[i];

      if (item) {
        const { callback, index } = initial[i];
        promise.then(() =>
          callback().then((result) => next(i)({ index, result }))
        );
        resolve();
      }
    }

    await Promise.all(map(results, "promise"));

    return map(results, "result") as TResponse[];
  };
}

export async function retry<TResult>(
  async: () => Promise<TResult>,
  retries: number,
  wait: number,
  attempt = 1
): Promise<TResult> {
  try {
    const result = await async();
    return result;
  } catch (error) {
    if (attempt <= retries) {
      await sleep(wait);
      return retry<TResult>(async, retries, wait, attempt + 1);
    } else {
      throw error;
    }
  }
}
