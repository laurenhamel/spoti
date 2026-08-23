export interface RetryHandlers {
  before?: (payload: { attempt: number; retried: boolean }) => void;
  after?: (payload: {
    error?: Error;
    attempt: number;
    retrying: boolean;
  }) => boolean | void;
}
