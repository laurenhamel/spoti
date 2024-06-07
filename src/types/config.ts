export type SpotiCliArgs = [];

export interface SpotiCliOptions extends SpotiOptions {
  [key: string]: unknown;
}

export interface SpotiOptions {
  verbose: boolean;
  pwd?: string;
}
