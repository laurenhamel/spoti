export interface RetryHandlers {
  before?: (payload: { attempt: number; retried: boolean }) => void;
  after?: (payload: {
    error?: Error;
    attempt: number;
    retrying: boolean;
  }) => boolean | void;
}

export type PromiseCallback<TReturn = unknown> = () => Promise<TReturn>;

export type PromiseCallbackReturnType<TCallback extends PromiseCallback> =
  Awaited<ReturnType<TCallback>>;

export type PromiseCallbackReturnTypeArray<
  TCallbacks extends PromiseCallback[],
> = {
  [TIndex in keyof TCallbacks]: PromiseCallbackReturnType<TCallbacks[TIndex]>;
};
