import { runInBatches } from "../batches.js";
import type { Db } from "../db.js";
import { deliverBatch } from "./store.js";

const BATCH_SIZE = 100;

// Each batch is its own short transaction, so a long backlog never holds its locks for the whole run.
export function deliverDueReminders(db: Db, now: Date, batchSize = BATCH_SIZE): Promise<void> {
  return runInBatches(batchSize, () => deliverBatch(db, now, batchSize));
}
