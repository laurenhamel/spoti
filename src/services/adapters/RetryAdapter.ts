import { type SpotiOptions } from "../../types/config";
import { sleep } from "../../utils/promise";
import { type RetryAdapterInstance } from "./types";
import { merge } from "lodash-es";
import { type Headers } from "node-fetch";

export interface RetryAdapterConfig {
  codes: number[];
  header: string;
  timeout: number;
  max: number;
}

export default class RetryAdapter implements RetryAdapterInstance {
  readonly config: RetryAdapterConfig;

  constructor(config?: Partial<RetryAdapterConfig>) {
    this.config = merge(
      {
        codes: [429],
        header: "Retry-After",
        timeout: 30000, // 30s
        max: 10,
      },
      config
    );

    this.validate();
  }

  private validate(): void {
    if (!this.config.codes.length) {
      throw new Error("Missing retry status codes.");
    }
  }

  private get codes(): number[] {
    return this.config.codes;
  }

  private get header(): string {
    return this.config.header;
  }

  private get timeout(): number {
    return this.config.timeout;
  }

  sleep(status: number, headers: Headers): number | undefined {
    if (!this.codes.includes(status)) return;

    const retryAfter = headers.get(this.header);

    if (!retryAfter) return this.timeout;

    const seconds = Number(retryAfter);
    return Number.isFinite(seconds) && seconds >= 0
      ? seconds * 1000
      : this.timeout;
  }

  async retry<
    TResponse extends Record<string, unknown>,
    TOptions extends SpotiOptions,
    TRequest extends () => Promise<TResponse> = () => Promise<TResponse>,
  >(
    status: number,
    headers: Headers,
    request: TRequest,
    options?: TOptions,
    attempt = 1
  ): Promise<TResponse> {
    const wait = this.sleep(status, headers);

    if (wait !== undefined && attempt <= this.config.max) {
      options?.verbose && console.log(`Retrying in ${wait / 1000}s...`);
      await sleep(wait);
      return request();
    } else {
      throw new Error(`Retry for status code ${status} not supported.`);
    }
  }
}
