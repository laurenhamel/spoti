import { Progress } from "./progress";
import chalk from "chalk";

export async function sleep(
  wait: number,
  meanwhile?: { callback: () => void; done?: () => void; interval: number }
): Promise<void> {
  return new Promise((resolve) => {
    let interval: NodeJS.Timeout;

    if (meanwhile) {
      interval = setInterval(meanwhile.callback, meanwhile.interval);
    }

    setTimeout(() => {
      if (interval) {
        clearInterval(interval);
        meanwhile?.done?.();
      }

      resolve();
    }, wait);
  });
}

export async function throttle(wait: number, message?: string): Promise<void> {
  const seconds = wait / 1000;
  const increment = 100 / seconds / 100;

  const throttle$ = message
    ? new Progress(
        message,
        {
          type: "percentage",
          percentage: 0,
          message: `${wait / 1000}s`,
          nameTransformFn: chalk.magenta,
        },
        (() => {
          let elapsed = 0;
          let percentage = 0;

          return (): void => {
            elapsed++;
            percentage += increment;
            const message = `${seconds - elapsed}s`;
            throttle$?.update(percentage, message);
          };
        })()
      )
    : undefined;

  await sleep(wait, {
    callback: () => throttle$?.report(),
    done: () => {
      throttle$?.done();
      throttle$?.remove();
    },
    interval: 1000, // 1s
  });
}
