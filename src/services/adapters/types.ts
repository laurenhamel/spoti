import { type Headers } from "node-fetch";

export interface AuthorizationAdapterInstance {
  authorize: () => Promise<Record<"Authorization", string>>;
}

export interface RetryAdapterInstance {
  retry: <
    TResponse extends Record<string, unknown>,
    TRequest extends () => Promise<TResponse> = () => Promise<TResponse>
  >(
    status: number,
    headers: Headers,
    request: TRequest
  ) => Promise<TResponse>;
}
