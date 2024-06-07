import fetch, { type Headers, type Response } from "node-fetch";
import qs from "qs";
import { merge, template, snakeCase, trimEnd, trimStart } from "lodash-es";
import chalk from "chalk";
import { SpotiOptions } from "../../types/config";
import {
  type RetryAdapterInstance,
  type AuthorizationAdapterInstance,
} from "../adapters";

export type RestApiInstance<
  TInstance extends InstanceType<typeof RestApi<RestApiEndpoints>>
> = TInstance extends InstanceType<
  typeof RestApi<infer TEndpoints extends RestApiEndpoints>
>
  ? InstanceType<typeof RestApi<TEndpoints>> & {
      [method in keyof TEndpoints]: RestApiRequestMethod;
    }
  : any;

export interface RestApiConfig<TEndpoints extends RestApiEndpoints> {
  api: string;
  endpoints: TEndpoints;
  adapters?: RestApiAdapters;
}

export interface RestApiAdapters {
  authorization?: AuthorizationAdapterInstance;
  retry?: RetryAdapterInstance;
}

export enum RestApiMethod {
  DELETE = "DELETE",
  GET = "GET",
  PATCH = "PATCH",
  POST = "POST",
  PUT = "PUT",
}

export interface RestApiEndpointConfig {
  method: RestApiMethod;
  path: string;
  data?: Record<string, unknown>;
  retry?: boolean;
}

export type RestApiRequestMethod = <
  TResponse extends Record<string, unknown> = any,
  TData extends Record<string, unknown> = any,
  TOptions extends SpotiOptions = SpotiOptions
>(
  data?: TData,
  options?: TOptions
) => Promise<TResponse>;

export type RestApiEndpoints = Record<string, RestApiEndpointConfig>;

export default class RestApi<TEndpoints extends RestApiEndpoints> {
  readonly config: RestApiConfig<TEndpoints>;

  constructor(config: RestApiConfig<TEndpoints>) {
    this.config = config;

    for (const name in this.config.endpoints) {
      const { method, path, data, retry } = this.config.endpoints[name];
      const fn =
        this[snakeCase(method) as "get" | "post" | "put" | "delete" | "patch"];
      Object.assign(this, { [name]: fn.call(this, path, data, retry) });
    }
  }

  private async request<
    TData extends Record<string, unknown>,
    TResponse extends Record<string, unknown>,
    TOptions extends SpotiOptions = SpotiOptions
  >(
    method: RestApiMethod,
    endpoint: string,
    data?: TData,
    options?: TOptions,
    retries = true,
    attempt = 1
  ): Promise<TResponse> {
    const path = template(endpoint)(data);
    const params = this.params<TData>(method, data);
    const body = this.body<TData>(method, data);
    const base = trimEnd(this.config.api, "/") + "/" + trimStart(path, "/");
    const url = base + params;

    try {
      const authorization = await this.authorize();
      const request = {
        method,
        body,
        headers: { "Content-Type": "application/json", ...authorization },
      };

      if (options?.verbose) {
        console.log();
        console.log(chalk.bold.dim("Request"));
        console.log(chalk.magenta(request.method), chalk.cyan(base));
        console.log(request);
      }

      const response = await fetch(url, request);

      return this.response<TResponse, TOptions>(
        response,
        (attempt) => () =>
          this.request<TData, TResponse, TOptions>(
            method,
            endpoint,
            data,
            options,
            retries,
            attempt
          ),
        options,
        retries,
        attempt
      );
    } catch (error) {
      throw error;
    }
  }

  private async response<
    TResponse extends Record<string, unknown>,
    TOptions extends SpotiOptions = SpotiOptions
  >(
    response: Response,
    signature: (attempt: number) => () => Promise<TResponse>,
    options?: TOptions,
    retries = true,
    attempt = 1
  ): Promise<TResponse> {
    try {
      const { ok, status, statusText: message, headers } = response;

      if (options?.verbose) {
        const color = getStatusColor(status);
        console.log();
        console.log(chalk.bold.dim("Response"));
        console.log(chalk[color](`${status} ${message}`));
      }

      if (ok) {
        const body = await response.json();
        return body as TResponse;
      } else if (retries) {
        try {
          const result = await this.retry<TResponse>(
            status,
            headers,
            signature(attempt + 1)
          );

          if (result) {
            return result;
          } else {
            throw new Error("No retry adapter found.");
          }
        } catch (error) {
          throw new Error(`Request failed: ${status} ${message}. ${error}`);
        }
      } else {
        throw new Error(message);
      }
    } catch (error) {
      throw error;
    }
  }

  private parameterized: RestApiMethod[] = [RestApiMethod.GET];

  private async authorize(): Promise<
    Record<"Authorization", string> | undefined
  > {
    return this.config.adapters?.authorization?.authorize();
  }

  private async retry<
    TResponse extends Record<string, unknown>,
    TRequest extends () => Promise<TResponse> = () => Promise<TResponse>
  >(
    status: number,
    headers: Headers,
    request: TRequest
  ): Promise<TResponse | undefined> {
    return this.config.adapters?.retry?.retry<TResponse>(
      status,
      headers,
      request
    );
  }

  private body<TData extends Record<string, unknown>>(
    method: RestApiMethod,
    data: TData = {} as TData
  ): string | undefined {
    return !this.parameterized.includes(method)
      ? JSON.stringify(data)
      : undefined;
  }

  private params<TData extends Record<string, unknown>>(
    method: RestApiMethod,
    data: TData = {} as TData
  ): string | undefined {
    return this.parameterized.includes(method)
      ? `?${qs.stringify(data)}`
      : undefined;
  }

  private get<TData extends Record<string, unknown>>(
    endpoint: string,
    initial: TData = {} as TData,
    retry = true
  ): RestApiRequestMethod {
    return async <
      TResponse extends Record<string, unknown> = any,
      TData extends Record<string, unknown> = any,
      TOptions extends SpotiOptions = SpotiOptions
    >(
      data?: TData,
      options?: TOptions
    ) =>
      this.request<TData, TResponse, TOptions>(
        RestApiMethod.GET,
        endpoint,
        merge(initial, data),
        options,
        retry
      );
  }

  private post<TData extends Record<string, unknown>>(
    endpoint: string,
    initial: TData = {} as TData,
    retry = true
  ): RestApiRequestMethod {
    return async <
      TResponse extends Record<string, unknown> = any,
      TData extends Record<string, unknown> = any,
      TOptions extends SpotiOptions = SpotiOptions
    >(
      data?: TData,
      options?: TOptions
    ) =>
      this.request<TData, TResponse, TOptions>(
        RestApiMethod.POST,
        endpoint,
        merge(initial, data),
        options,
        retry
      );
  }

  private put<TData extends Record<string, unknown>>(
    endpoint: string,
    initial: TData = {} as TData,
    retry = true
  ): RestApiRequestMethod {
    return async <
      TResponse extends Record<string, unknown> = any,
      TData extends Record<string, unknown> = any,
      TOptions extends SpotiOptions = SpotiOptions
    >(
      data?: TData,
      options?: TOptions
    ) =>
      this.request<TData, TResponse, TOptions>(
        RestApiMethod.PUT,
        endpoint,
        merge(initial, data),
        options,
        retry
      );
  }

  private patch<TData extends Record<string, unknown>>(
    endpoint: string,
    initial: TData = {} as TData,
    retry = true
  ): RestApiRequestMethod {
    return async <
      TResponse extends Record<string, unknown> = any,
      TData extends Record<string, unknown> = any,
      TOptions extends SpotiOptions = SpotiOptions
    >(
      data?: TData,
      options?: TOptions
    ) =>
      this.request<TData, TResponse, TOptions>(
        RestApiMethod.PATCH,
        endpoint,
        merge(initial, data),
        options,
        retry
      );
  }

  private delete<TData extends Record<string, unknown>>(
    endpoint: string,
    initial: TData = {} as TData,
    retry = true
  ): RestApiRequestMethod {
    return async <
      TResponse extends Record<string, unknown> = any,
      TData extends Record<string, unknown> = any,
      TOptions extends SpotiOptions = SpotiOptions
    >(
      data?: TData,
      options?: TOptions
    ) =>
      this.request<TData, TResponse, TOptions>(
        RestApiMethod.DELETE,
        endpoint,
        merge(initial, data),
        options,
        retry
      );
  }
}

function getStatusColor(status: number): "red" | "green" | "yellow" {
  return status >= 200 && status < 400
    ? "green"
    : status >= 400
    ? "red"
    : "yellow";
}
