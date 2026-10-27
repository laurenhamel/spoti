import { type HeaderAdapterInstance } from "./types";
import { isFunction } from "lodash-es";

export type HeaderAdapterHeaders =
  Record<string, unknown> | (() => Record<string, unknown>);

export interface HeaderAdapterConfig {
  headers: HeaderAdapterHeaders;
}

export default class HeaderAdapter implements HeaderAdapterInstance {
  readonly config: HeaderAdapterConfig;

  constructor(config: HeaderAdapterConfig) {
    this.config = config;
  }

  private get data(): Record<string, unknown> {
    return isFunction(this.config.headers)
      ? this.config.headers()
      : this.config.headers;
  }

  headers(): Record<string, unknown> {
    return this.data;
  }
}
