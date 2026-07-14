// The survival sweep (every 5 min), position opens (agent tool calls), and position
// closes/stop-loss sells (agent tool calls + the 60s poller) all read and mutate the SAME
// operational wallet from independent timers and call sites. Without serializing them, two
// could race between reading a balance/exposure total and submitting a transaction against it.
// This is a single process-wide async mutex — Node is single-threaded, so a promise chain is
// enough to guarantee only one wallet-touching operation runs at a time.
let queue: Promise<unknown> = Promise.resolve();

export function withWalletLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn);
  queue = result.then(() => undefined, () => undefined);
  return result;
}
