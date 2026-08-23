import { type PolicyAdapterInstance } from "./types";
import limit from "p-limit";
import throttle, { type Options } from "p-throttle";

export const MAX_CONCURRENT_REQUESTS = 25;

const schedule = limit(MAX_CONCURRENT_REQUESTS);

export interface RateLimitOptions extends Options {}

export interface PolicyOptions {
  rateLimit?: RateLimitOptions;
}

/**
 * Applies a provider-specific rate limit before dispatching work through the
 * process-wide request scheduler.
 */
class PolicyAdapter implements PolicyAdapterInstance {
  readonly options: PolicyOptions;

  private limiter: ReturnType<typeof throttle> | undefined;

  private pausedUntil = 0;

  constructor(options: PolicyOptions = {}) {
    this.options = options;
    this.limiter = options.rateLimit ? throttle(options.rateLimit) : undefined;
  }

  private throttle<TResponse>(request: () => Promise<TResponse>) {
    return this.limiter?.(request);
  }

  private async waitForPause(): Promise<void> {
    const wait = this.pausedUntil - Date.now();

    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  private async schedule<TResponse>(
    request: () => Promise<TResponse>
  ): Promise<TResponse> {
    await this.waitForPause();

    return schedule(async () => {
      await this.waitForPause();
      return request();
    });
  }

  pause(wait: number): void {
    if (!Number.isFinite(wait) || wait < 0) return;

    this.pausedUntil = Math.max(this.pausedUntil, Date.now() + wait);
  }

  police<TResponse>(request: () => Promise<TResponse>): Promise<TResponse> {
    const throttled = this.throttle(() => this.schedule(request));
    return throttled ? throttled() : this.schedule(request);
  }
}

export default PolicyAdapter;
