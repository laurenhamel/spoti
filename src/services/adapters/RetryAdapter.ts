import { merge } from "lodash-es";
import { type RetryAdapterInstance } from "./types";
import { type Headers } from "node-fetch";
import { sleep } from "../../utils";

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

  async retry<
    TResponse extends Record<string, unknown>,
    TRequest extends () => Promise<TResponse> = () => Promise<TResponse>
  >(
    status: number,
    headers: Headers,
    request: TRequest,
    attempt = 1
  ): Promise<TResponse> {
    if (this.codes.includes(status) && attempt <= this.config.max) {
      const retry = headers.get(this.header);
      const wait = retry ? parseInt(retry) * 1000 : this.timeout;
      console.log(`Retrying in ${wait / 1000}s...`);
      await sleep(wait);
      return request();
    } else {
      throw new Error(`Retry for status code ${status} not supported.`);
    }
  }
}
