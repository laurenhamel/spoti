import { type Headers } from "node-fetch";

export interface AuthorizationAdapterInstance {
  authorize: () => Promise<Record<"Authorization", string>>;
}

export interface PolicyAdapterInstance {
  police: <TResponse>(request: () => Promise<TResponse>) => Promise<TResponse>;
  pause: (wait: number) => void;
}

export interface RetryAdapterInstance {
  sleep: (status: number, headers: Headers) => number | undefined;
  retry: <
    TResponse extends Record<string, unknown>,
    TRequest extends () => Promise<TResponse> = () => Promise<TResponse>,
  >(
    status: number,
    headers: Headers,
    request: TRequest
  ) => Promise<TResponse>;
}
