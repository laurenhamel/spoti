import fetch from "node-fetch";
import qs from "qs";
import { type AuthorizationAdapterInstance } from "./types";

export enum AccessTokenAdapterType {
  FORM = "application/x-www-form-urlencoded",
  JSON = "application/json",
}

export interface AccessTokenAdapterData {
  token: string;
  type: string;
  expires: Date;
}

export interface AccessTokenAdapterConfig<
  TResponse extends Record<string, unknown>,
  TCredentials extends Record<string, unknown> = Record<string, unknown>
> {
  url: string;
  type: AccessTokenAdapterType;
  credentials: TCredentials;
  handler: AccessTokenAdapterHandler<TResponse>;
}

export type AccessTokenAdapterHandler<
  TResponse extends Record<string, unknown>
> = (response: TResponse) => AccessTokenAdapterData;

export default class AccessTokenAdapter<
  TResponse extends Record<string, unknown>,
  TCredentials extends Record<string, unknown> = Record<string, unknown>
> implements AuthorizationAdapterInstance
{
  readonly config: AccessTokenAdapterConfig<TResponse, TCredentials>;

  constructor(config: AccessTokenAdapterConfig<TResponse, TCredentials>) {
    this.config = config;
    this.validate();
  }

  private validate(): void {
    const errors: string[] = [];

    for (const key in this.config.credentials) {
      const value = this.config.credentials[key];

      if (!value) {
        errors.push(`Missing access token credential(s): ${key}`);
      }
    }

    if (errors.length) {
      throw new Error(errors.join("\n"));
    }
  }

  private get url(): string {
    return this.config.url;
  }

  private get type(): AccessTokenAdapterType {
    return this.config.type;
  }

  private get credentials(): Record<string, unknown> {
    return this.config.credentials;
  }

  private get handler(): AccessTokenAdapterHandler<TResponse> {
    return this.config.handler;
  }

  private get body(): string {
    const handlers: Record<AccessTokenAdapterType, () => string> = {
      [AccessTokenAdapterType.FORM]: () => qs.stringify(this.credentials),
      [AccessTokenAdapterType.JSON]: () => JSON.stringify(this.credentials),
    };

    return handlers[this.type]();
  }

  private get valid(): boolean {
    return !!this.token && this.token.expires.getTime() < Date.now();
  }

  private token: AccessTokenAdapterData | undefined;

  private async refresh(): Promise<AccessTokenAdapterData> {
    if (!this.valid) {
      try {
        const response = await fetch(this.url, {
          method: "POST",
          body: this.body,
          headers: { "Content-Type": this.type },
        });

        const data = (await response.json()) as TResponse;

        this.token = this.handler(data);
      } catch (error) {
        throw error;
      }
    }

    return this.token as AccessTokenAdapterData;
  }

  async authorize(): Promise<Record<"Authorization", string>> {
    const { token, type } = await this.refresh();
    const Authorization = `${type} ${token}`;
    return { Authorization };
  }
}
