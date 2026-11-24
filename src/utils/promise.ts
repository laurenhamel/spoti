import type {
  PromiseCallback,
  PromiseCallbackReturnTypeArray,
  RetryHandlers,
} from "../types/promise";
import { isFunction } from "lodash-es";
import limit from "p-limit";
import { createProcessExitAbort } from "./process";

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

export async function drain<TCallbacks extends PromiseCallback[]>(
  callbacks: TCallbacks
): Promise<PromiseCallbackReturnTypeArray<TCallbacks>> {
  const controller = createProcessExitAbort();
  const { signal } = controller;
  const promises = callbacks.map((callback) => callback(signal));
  const results = await Promise.all(promises);
  return results as PromiseCallbackReturnTypeArray<TCallbacks>;
}

export function pool(
  max: number
): <TResponse>(
  callbacks: PromiseCallback<TResponse>[]
) => Promise<TResponse[]> {
  const concurrency = Math.max(max, 1);
  const task = limit({ concurrency, rejectOnClear: true });
  
  return async <TResponse>(
    callbacks: PromiseCallback<TResponse>[]
  ): Promise<TResponse[]> => {
    const controller = createProcessExitAbort();
    const { signal } = controller;

    signal.addEventListener('abort', () => {
      task.clearQueue();
    });

    const tasks = callbacks.map(callback => task(async () => {
      signal.throwIfAborted();
      return callback(signal);
    }));

    const results = await Promise.all(tasks);
    return results;
  };
}

export async function retry<TResult>(
  async: PromiseCallback<TResult>,
  retries: number,
  wait: number | ((attempt: number) => number),
  { before, after }: RetryHandlers | undefined = {},
  attempt = 1
): Promise<TResult> {
  try {
    const controller = createProcessExitAbort();
    const { signal } = controller;
    const retried = attempt > 1;
    before?.({ attempt, retried });
    const result = await async(signal);
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
