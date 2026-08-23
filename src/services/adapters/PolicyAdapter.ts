import { type PolicyAdapterInstance } from "./types";
import limit from "p-limit";
import throttle, { type Options } from "p-throttle";

export const MAX_CONCURRENT_REQUESTS = 25;

const schedule = limit(MAX_CONCURRENT_REQUESTS);

export interface RateLimitOptions extends Options {}

export interface PolicyOptions {
  rateLimit: RateLimitOptions;
}

/**
 * Applies a provider-specific rate limit before dispatching work through the
 * process-wide request scheduler.
 */
class PolicyAdapter implements PolicyAdapterInstance {
  readonly options: PolicyOptions;

  private limiter: ReturnType<typeof throttle>;

  constructor(options: PolicyOptions) {
    this.options = options;
    this.limiter = throttle(options.rateLimit);
  }

  private throttle<TResponse>(request: () => Promise<TResponse>) {
    return this.limiter(request);
  }

  police<TResponse>(request: () => Promise<TResponse>): Promise<TResponse> {
    return this.throttle(() => schedule(request))();
  }
}

export default PolicyAdapter;
