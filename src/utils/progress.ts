/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ProcessExitRegister } from "../types/process";
import { Format } from "./format";
import { padEnd } from "lodash-es";
import { MultiProgressBars, type AddOptions } from "multi-progress-bars";

export class Progress {
  static progress: MultiProgressBars;

  readonly label: string;

  private reporter: ((...args: any[]) => void) | undefined;

  constructor(
    label: string,
    options: AddOptions,
    reporter?: (...args: any[]) => void
  ) {
    if (!Progress.progress) {
      Progress.progress = new MultiProgressBars({
        initMessage: " Spoti ",
        persist: true,
        border: true,
        anchor: "top",
      });
    }

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
