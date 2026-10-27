import { type QueryAdapterInstance } from "./types";
import { isFunction } from "lodash-es";

export type QueryStringAdapterParams =
  Record<string, unknown> | (() => Record<string, unknown>);

export interface QueryStringAdapterConfig {
  params: QueryStringAdapterParams;
}

export default class QueryStringAdapter implements QueryAdapterInstance {
  readonly config: QueryStringAdapterConfig;

  constructor(config: QueryStringAdapterConfig) {
    this.config = config;
  }

  private get data(): Record<string, unknown> {
    return isFunction(this.config.params)
      ? this.config.params()
      : this.config.params;
  }

  query(): Record<string, unknown> {
    return this.data;
  }
}
