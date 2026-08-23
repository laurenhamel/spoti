import { type RetryHandlers } from "../types/promise";
import { isFunction } from "lodash-es";
import limit from "p-limit";

export class Deferred<TResponse = void> {
  promise: Promise<TResponse>;

  state: "pending" | "resolved" | "rejected" = "pending";

  result: TResponse | undefined;

  // @ts-expect-error Capturing callback of promise
  resolve: (value: TResponse | PromiseLike<TResponse>) => void;

  // @ts-expect-error Capturing callback of promise
  reject: (value: Error) => void;

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
      this.result = result;
    }) as Promise<TResponse>;
  }
}

export function pool(
  max: number
): <TResponse>(
  callbacks: (() => Promise<TResponse>)[]
) => Promise<TResponse[]> {
  const task = limit(max);

  return async <TResponse>(
    callbacks: (() => Promise<TResponse>)[]
  ): Promise<TResponse[]> => {
    const tasks = callbacks.map(task);
    const results = await Promise.all(tasks);
    return results;
  };
}

export async function retry<TResult>(
  async: () => Promise<TResult>,
  retries: number,
  wait: number | ((attempt: number) => number),
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
    const proceed = after?.({ attempt, error, retrying }) ?? true;

    if (retrying && proceed) {
      const delay = isFunction(wait) ? wait(attempt) : wait;
      await sleep(delay);
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

export async function sleep(
  wait: number,
  meanwhile?: { callback: () => void; done?: () => void; interval: number }
): Promise<void> {
  return new Promise((resolve) => {
    let interval: NodeJS.Timeout;

    if (meanwhile) {
      interval = setInterval(meanwhile.callback, meanwhile.interval);
    }

    setTimeout(() => {
      if (interval) {
        clearInterval(interval);
        meanwhile?.done?.();
      }

      resolve();
    }, wait);
  });
}
