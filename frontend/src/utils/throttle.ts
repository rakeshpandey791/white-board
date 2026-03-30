export function throttle<T extends (...args: any[]) => void>(fn: T, interval: number) {
  let last = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last < interval) {
      return;
    }
    last = now;
    fn(...args);
  };
}
