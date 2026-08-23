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
