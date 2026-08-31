import { type SpotiOptions } from "../../types/config";
import {
  type RetryAdapterInstance,
  type AuthorizationAdapterInstance,
  type PolicyAdapterInstance,
  type PaginationAdapterInstance,
  type PaginationOptions,
} from "../adapters";
import chalk from "chalk";
import {
  find,
  merge,
  snakeCase,
  trimEnd,
  trimStart,
  isNil,
  escapeRegExp,
} from "lodash-es";
import fetch, { type Headers, type Response } from "node-fetch";
import qs from "qs";
import {
  UriTemplateExpander,
  UriTemplateMatcher,
  type MatchResult,
} from "uri-template-matcher";

export type RestApiInstance<
  TInstance extends InstanceType<
    typeof RestApi<Record<string, RestApiEndpointOptions>>
  >,
> =
  TInstance extends InstanceType<
    typeof RestApi<
      infer TEndpoints extends Record<string, RestApiEndpointOptions>
    >
  >
    ? InstanceType<typeof RestApi<TEndpoints>> & {
        [method in keyof TEndpoints]: RestApiRequestMethod;
      }
    : unknown;

export interface RestApiOptions<
  TEndpoints extends Record<string, RestApiEndpointOptions>,
> {
  api: string;
  endpoints: TEndpoints;
  adapters?: RestApiAdapters;
}

export interface RestApiAdapters {
  authorization?: AuthorizationAdapterInstance;
  policy?: PolicyAdapterInstance;
  retry?: RetryAdapterInstance;
  pagination?: PaginationAdapterInstance;
}

export enum RestApiMethod {
  DELETE = "DELETE",
  GET = "GET",
  PATCH = "PATCH",
  POST = "POST",
  PUT = "PUT",
}

export interface RestApiEndpointOptions {
  method: RestApiMethod;
  path: string;
  data?: Record<string, unknown>;
  retry?: boolean;
  pagination?: string | PaginationOptions;
}

export type RestApiRequestMethod = <
  TResponse extends Record<string, unknown> = Record<string, unknown>,
  TData extends Record<string, unknown> = Record<string, unknown>,
  TOptions extends SpotiOptions = SpotiOptions,
>(
  data?: TData,
  options?: TOptions
) => Promise<TResponse>;

type RestApiEndpointConfig<TEndpoint extends RestApiEndpointOptions> =
  TEndpoint & {
    matches: (endpoint: string) => boolean;
    parse: (endpoint: string) => MatchResult | null;
    expand: (data?: Record<string, unknown>) => string;
  };

interface RestApiConfig<
  TEndpoints extends Record<string, RestApiEndpointOptions>,
> {
  api: string;
  endpoints: {
    [TEndpoint in keyof TEndpoints]: RestApiEndpointConfig<
      TEndpoints[TEndpoint]
    >;
  };
  adapters?: RestApiAdapters;
}

export default class RestApi<
  TEndpoints extends Record<string, RestApiEndpointOptions>,
> {
  readonly config: RestApiConfig<TEndpoints>;

  matcher: InstanceType<typeof UriTemplateMatcher>;

  constructor(options: RestApiOptions<TEndpoints>) {
    this.config = options as RestApiConfig<TEndpoints>;
    this.matcher = new UriTemplateMatcher();

    for (const name in this.config.endpoints) {
      const endpoint = this.config.endpoints[name];
      const { method, path, data, retry, pagination } = endpoint;
      const matcher = new UriTemplateMatcher();
      const expander = new UriTemplateExpander(path);

      this.matcher.add(path);
      matcher.add(path);

      this.config.endpoints[name] = merge({}, endpoint, {
        matches: (endpoint: string) => !isNil(matcher.match(endpoint)),
        parse: (endpoint: string) => this.matcher.match(endpoint),
        expand: (data: Record<string, unknown>) => expander.expand(data),
      });

      type MethodName = "get" | "post" | "put" | "delete" | "patch";

      const fn = this[snakeCase(method) as MethodName];

      Object.assign(this, {
        [name]: fn.call(this, path, data, retry, pagination),
      });
    }
  }

  private find(path: string): RestApiEndpointConfig<RestApiEndpointOptions> {
    return find(Object.values(this.config.endpoints), { path })!;
  }

  private async request<
    TData extends Record<string, unknown>,
    TResponse extends Record<string, unknown>,
    TOptions extends SpotiOptions = SpotiOptions,
  >(
    method: RestApiMethod,
    endpoint: string,
    data?: TData,
    options?: TOptions,
    retries = true,
    pagination?: string | PaginationOptions,
    attempt = 1
  ): Promise<TResponse> {
    const config = this.find(endpoint);
    const path = config.expand(data);
    const params = this.params<TData>(method, data);
    const body = this.body<TData>(method, data);
    const base = trimEnd(this.config.api, "/") + "/" + trimStart(path, "/");
    const url = base + params;

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
      console.log({
        ...request,
        parameters:
          request.method === RestApiMethod.GET
            ? params
              ? qs.parse(params, {
                  comma: true,
                  ignoreQueryPrefix: true,
                  parseArrays: true,
                  duplicates: "combine",
                  allowEmptyArrays: true,
                  allowDots: true,
                })
              : {}
            : undefined,
      });
    }

    const response = await this.police(() => fetch(url, request));

    const signature = (attempt: number) => () => {
      return this.request<TData, TResponse, TOptions>(
        method,
        endpoint,
        data,
        options,
        retries,
        pagination,
        attempt
      );
    };

    const page = async (url: string) => {
      const regex = new RegExp("^" + escapeRegExp(this.config.api));
      const uri = url.replace(regex, "");
      const { pathname, search } = new URL(uri, this.config.api);
      const query = trimStart(search, "?");
      const params = qs.parse(query);
      const match = this.matcher.match(pathname);
      const endpoint = match?.template ?? pathname;
      const config = this.find(endpoint);
      const data = merge({}, params, match?.params, config?.data) as TData;
      const pagination = config?.pagination ?? undefined;

      const response = await this.request<TData, TResponse, TOptions>(
        method,
        endpoint,
        data,
        options,
        retries
      );

      return { response, pagination };
    };

    return this.response<TResponse, TOptions>(
      response,
      signature,
      page,
      options,
      retries,
      pagination,
      attempt
    );
  }

  private async response<
    TResponse extends Record<string, unknown>,
    TOptions extends SpotiOptions = SpotiOptions,
  >(
    response: Response,
    signature: (attempt: number) => () => Promise<TResponse>,
    page: (url: string) => Promise<{
      response: TResponse;
      pagination?: string | PaginationOptions;
    }>,
    options?: TOptions,
    retries = true,
    pagination?: string | PaginationOptions,
    attempt = 1
  ): Promise<TResponse> {
    const { ok, status, statusText: message, headers } = response;

    if (options?.verbose) {
      const color = getStatusColor(status);
      console.log();
      console.log(chalk.bold.dim("Response"));
      console.log(chalk[color](`${status} ${message}`));
    }

    if (status === 429) this.pause(this.sleep(status, headers));

    if (ok) {
      const body = (await response.json()) as TResponse;
      const paginated = await this.paginate<TResponse>(body, pagination, page);
      return paginated;
    } else if (retries) {
      try {
        const result = await this.retry<TResponse, TOptions>(
          status,
          headers,
          signature(attempt + 1),
          options
        );

        if (result) {
          return result;
        } else {
          throw new Error("No retry adapter found.");
        }
      } catch (error) {
        throw new Error(
          [`Request failed: ${status} ${message}.`, error as Error].join("\n"),
          { cause: { status, message, headers } }
        );
      }
    } else {
      throw new Error(message, {
        cause: { status, message, headers },
      });
    }
  }

  private parameterized: RestApiMethod[] = [RestApiMethod.GET];

  private async authorize(): Promise<
    Record<"Authorization", string> | undefined
  > {
    return this.config.adapters?.authorization?.authorize();
  }

  private async police<TResponse>(
    request: () => Promise<TResponse>
  ): Promise<TResponse> {
    return this.config.adapters?.policy?.police(request) ?? request();
  }

  private sleep(status: number, headers: Headers): number | undefined {
    return this.config.adapters?.retry?.sleep(status, headers);
  }

  private pause(wait: number | undefined): void {
    if (wait !== undefined) this.config.adapters?.policy?.pause(wait);
  }

  private async retry<
    TResponse extends Record<string, unknown>,
    TOptions extends SpotiOptions,
    TRequest extends () => Promise<TResponse> = () => Promise<TResponse>,
  >(
    status: number,
    headers: Headers,
    request: TRequest,
    options?: TOptions
  ): Promise<TResponse | undefined> {
    return this.config.adapters?.retry?.retry<TResponse, TOptions>(
      status,
      headers,
      request,
      options
    );
  }

  private async paginate<TResponse extends Record<string, unknown>>(
    response: TResponse,
    pagination: string | PaginationOptions | undefined,
    page: (url: string) => Promise<{
      response: TResponse;
      pagination?: string | PaginationOptions;
    }>
  ): Promise<TResponse> {
    if (!pagination) return response;

    return (
      this.config.adapters?.pagination?.paginate(response, pagination, page) ??
      response
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
      ? `?${qs.stringify(data, { arrayFormat: "comma" })}`
      : undefined;
  }

  private get<TData extends Record<string, unknown>>(
    endpoint: string,
    initial: TData = {} as TData,
    retry = true,
    pagination: string | PaginationOptions | undefined
  ): RestApiRequestMethod {
    return async <
      TResponse extends Record<string, unknown> = Record<string, unknown>,
      TData extends Record<string, unknown> = Record<string, unknown>,
      TOptions extends SpotiOptions = SpotiOptions,
    >(
      data?: TData,
      options?: TOptions
    ) =>
      this.request<TData, TResponse, TOptions>(
        RestApiMethod.GET,
        endpoint,
        merge(initial, data),
        options,
        retry,
        pagination
      );
  }

  private post<TData extends Record<string, unknown>>(
    endpoint: string,
    initial: TData = {} as TData,
    retry = true,
    pagination: string | PaginationOptions | undefined
  ): RestApiRequestMethod {
    return async <
      TResponse extends Record<string, unknown> = Record<string, unknown>,
      TData extends Record<string, unknown> = Record<string, unknown>,
      TOptions extends SpotiOptions = SpotiOptions,
    >(
      data?: TData,
      options?: TOptions
    ) =>
      this.request<TData, TResponse, TOptions>(
        RestApiMethod.POST,
        endpoint,
        merge(initial, data),
        options,
        retry,
        pagination
      );
  }

  private put<TData extends Record<string, unknown>>(
    endpoint: string,
    initial: TData = {} as TData,
    retry = true,
    pagination: string | PaginationOptions | undefined
  ): RestApiRequestMethod {
    return async <
      TResponse extends Record<string, unknown> = Record<string, unknown>,
      TData extends Record<string, unknown> = Record<string, unknown>,
      TOptions extends SpotiOptions = SpotiOptions,
    >(
      data?: TData,
      options?: TOptions
    ) =>
      this.request<TData, TResponse, TOptions>(
        RestApiMethod.PUT,
        endpoint,
        merge(initial, data),
        options,
        retry,
        pagination
      );
  }

  private patch<TData extends Record<string, unknown>>(
    endpoint: string,
    initial: TData = {} as TData,
    retry = true,
    pagination: string | PaginationOptions | undefined
  ): RestApiRequestMethod {
    return async <
      TResponse extends Record<string, unknown> = Record<string, unknown>,
      TData extends Record<string, unknown> = Record<string, unknown>,
      TOptions extends SpotiOptions = SpotiOptions,
    >(
      data?: TData,
      options?: TOptions
    ) =>
      this.request<TData, TResponse, TOptions>(
        RestApiMethod.PATCH,
        endpoint,
        merge(initial, data),
        options,
        retry,
        pagination
      );
  }

  private delete<TData extends Record<string, unknown>>(
    endpoint: string,
    initial: TData = {} as TData,
    retry = true,
    pagination: string | PaginationOptions | undefined
  ): RestApiRequestMethod {
    return async <
      TResponse extends Record<string, unknown> = Record<string, unknown>,
      TData extends Record<string, unknown> = Record<string, unknown>,
      TOptions extends SpotiOptions = SpotiOptions,
    >(
      data?: TData,
      options?: TOptions
    ) =>
      this.request<TData, TResponse, TOptions>(
        RestApiMethod.DELETE,
        endpoint,
        merge(initial, data),
        options,
        retry,
        pagination
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
