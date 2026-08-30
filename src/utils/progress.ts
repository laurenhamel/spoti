/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ProcessExitRegister } from "../types/process";
import {
  type ProgressSubscription,
  type ProgressOptions,
  type ProgressPayload,
} from "../types/progress";
import { Format } from "./format";
import { padEnd, merge } from "lodash-es";
import { MultiProgressBars, type AddOptions } from "multi-progress-bars";

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

/** @deprecated Use `ProgressV2` instead. */
export class Progress {
  static progress: MultiProgressBars;

  readonly label: string;

  private reporter: ((...args: any[]) => void) | undefined;

  constructor(
    label: string,
    options: AddOptions,
    reporter?: (...args: any[]) => void
  ) {
    Progress.progress = getMultiProgressBar();
    this.label = Progress.label(label);
    this.reporter = reporter;
    Progress.progress.addTask(this.label, options);
  }

  increment(percentage: number, message: string = "") {
    Progress.progress?.incrementTask(this.label, { percentage, message });
  }

  update(percentage: number, message: string = "") {
    Progress.progress?.updateTask(this.label, { percentage, message });
  }

  done(message: string = "") {
    Progress.progress?.done(this.label, { message });
    Progress.progress?.close();
  }

  remove() {
    Progress.progress?.removeTask(this.label);
  }

  report(...args: any[]) {
    this.reporter?.(...args);
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

  static label(title: string, length = this.FIXED_LABEL_LENGTH): string {
    return padEnd(
      Format.sanitize(
        title.length > length ? title.substring(0, length - 1) + "…" : title
      ),
      length,
      " "
    );
  }

  static FIXED_LABEL_LENGTH = 40;
}

export class ProgressV2 {
  static progress: MultiProgressBars;

  readonly label: string;
  readonly subscriptions: ProgressSubscription[] = [];

  value: number;
  total: number;

  constructor(options: ProgressOptions) {
    ProgressV2.progress = getMultiProgressBar();
    this.label = ProgressV2.label(options.label);
    this.value = options.value ?? 0;
    this.total = options.total;
    this.subscriptions = options.subscribers ?? [];

    ProgressV2.progress.addTask(
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
    ProgressV2.progress?.updateTask(label, { percentage, message });
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
