import { map } from "lodash-es";
import { sleep } from "./timing";

export class Deferred<TResponse = void> {
  promise: Promise<TResponse>;

  state: "pending" | "resolved" | "rejected" = "pending";

  result: TResponse | undefined;

  // @ts-ignore Capturing callback of promise
  resolve: (value: TResponse | PromiseLike<TResponse>) => void;

  // @ts-ignore Capturing callback of promise
  reject: (value: TResponse | PromiseLike<TResponse>) => void;

  constructor() {
    this.promise = new Promise<TResponse>((resolve, reject) => {
      this.resolve = (value) => {
        this.state = "resolved";
        resolve(value);
      };

      this.reject = (value) => {
        this.state = "rejected";
        reject(value);
      };
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

export interface RetryHandlers {
  before?: (payload: { attempt: number; retried: boolean }) => void;
  after?: (payload: {
    error?: Error;
    attempt: number;
    retrying: boolean;
  }) => void;
}

export async function retry<TResult>(
  async: () => Promise<TResult>,
  retries: number,
  wait: number,
  { before, after }: RetryHandlers | undefined = {},
  attempt = 1
): Promise<TResult> {
  try {
    const retried = attempt > 1;
    before?.({ attempt, retried });
    const result = await async();
    after?.({ attempt, retrying: false });
    return result;
  } catch (e) {
    const error = e as Error;
    const retrying = attempt <= retries;
    after?.({ attempt, error, retrying });

    if (retrying) {
      await sleep(wait);
      return retry<TResult>(
        async,
        retries,
        wait,
        { before, after },
        attempt + 1
      );
    } else {
      throw error;
    }
  }
}
