import { type ChalkInstance } from "chalk";
import { type AddOptions } from "multi-progress-bars";

export type ProgressSubscription = (payload: ProgressPayload) => void;

export interface ProgressPayload {
  label: string;
  total: number;
  value: number;
  percentage: number;
  message: string;
}

export interface ProgressOptions {
  label: string;
  total: number;
  value?: number;
  color?: ChalkInstance;
  options?: AddOptions;
  subscribers?: ProgressSubscription[];
}
