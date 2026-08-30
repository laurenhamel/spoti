import { type ProcessExitRegister } from "../types/process";
import {
  type ProgressSubscription,
  type ProgressOptions,
  type ProgressPayload,
} from "../types/progress";
import { Format } from "./format";
import { merge } from "lodash-es";
import { MultiProgressBars } from "multi-progress-bars";

const PROGRESS_LABEL_LENGTH = 40;

const getMultiProgressBar = (() => {
  let progress: MultiProgressBars;

  return (): MultiProgressBars => {
    if (!progress) {
      progress = new MultiProgressBars({
        initMessage: " Spoti ",
        persist: true,
        border: true,
        anchor: "top",
      });
    }

    return progress;
  };
})();

export class Progress {
  static progress: MultiProgressBars;

  readonly label: string;
  readonly subscriptions: ProgressSubscription[] = [];

  value: number;
  total: number;

  constructor(options: ProgressOptions) {
    Progress.progress = getMultiProgressBar();
    this.label = Progress.label(options.label);
    this.value = options.value ?? 0;
    this.total = options.total;
    this.subscriptions = options.subscribers ?? [];

    Progress.progress.addTask(
      this.label,
      merge(
        {
          type: "percentage",
          percentage: this.percentage,
          message: this.message,
          nameTransformFn: options.color,
        },
        options.options
      )
    );
  }

  get message() {
    return `${this.value} / ${this.total}`;
  }

  get percentage() {
    return this.value / this.total;
  }

  private emit(): void {
    const payload: ProgressPayload = {
      label: this.label,
      message: this.message,
      value: this.value,
      total: this.total,
      percentage: this.percentage,
    };

    for (const subscription of this.subscriptions) {
      subscription(payload);
    }
  }

  update(amount: number): void {
    this.value += amount;
    const { label, percentage, message } = this;
    Progress.progress?.updateTask(label, { percentage, message });
    this.emit();
  }

  increment(): void {
    this.update(1);
  }

  decrement(): void {
    this.update(-1);
  }

  done() {
    Progress.progress?.done(this.label);
    Progress.progress?.close();
  }

  subscribe(payload: ProgressPayload): void {
    this.update(payload.value);
  }

  static gracefullyStopProgress: ProcessExitRegister = () => ({
    SIGINT: () => {
      Progress.progress?.close();
    },
    SIGTERM: async () => {
      await Progress.progress?.promise;
      Progress.progress?.close();
    },
  });

  static label(title: string, length = PROGRESS_LABEL_LENGTH): string {
    return Format.truncateText(title, length, true);
  }
}
