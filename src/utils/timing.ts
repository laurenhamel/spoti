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

export function toDuration(time?: number): string {
  if (time) {
    const ms = Math.floor((time % 1000) / 100);

    let s = Math.floor((time / 1000) % 60);
    let m = Math.floor((time / (1000 * 60)) % 60);
    let h = Math.floor((time / (1000 * 60 * 60)) % 24);

    const millisecond = ms.toFixed(2);
    const hour = h < 10 ? "0" + h : h;
    const minute = m < 10 ? "0" + m : m;
    const second = s < 10 ? "0" + s : s;

    return `${hour}:${minute}:${second}.${millisecond}`;
  }

  return "0:0:0.00";
}
