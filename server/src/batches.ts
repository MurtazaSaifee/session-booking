// Keeps going until a batch comes back short, which means nothing was left for it to take.
export async function runInBatches(batchSize: number, runBatch: () => Promise<number>): Promise<void> {
  let handled: number;
  do {
    handled = await runBatch();
  } while (handled === batchSize);
}
