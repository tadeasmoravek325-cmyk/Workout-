import { mergeData } from './sync';
import { changedRows, newestChange, rowsToData, type SyncRow } from './syncRows';
import type { BackupData } from '../store/store';

export interface SyncBackend {
  /** Rows changed on the server after `afterSeq`, oldest first, at most `limit`. */
  pull(afterSeq: number, limit: number): Promise<SyncRow[]>;
  push(rows: SyncRow[]): Promise<void>;
}

export interface SyncCursor {
  /** Highest server seq already merged. */
  seq: number;
  /** Local changes up to this time are already on the server. */
  pushedAt: number;
}

export interface SyncResult {
  cursor: SyncCursor;
  pushed: number;
  pulled: number;
  /** Merged data, or null when nothing came from the server. */
  merged: BackupData | null;
}

const PAGE = 500;
const BATCH = 200;

/**
 * One sync round: upload local changes, download everything newer than the cursor, merge.
 * Uploading first means the server's last-writer-wins check sees our edits before we read back.
 * The caller applies `merged` to the store and saves the cursor only after this resolves, so an
 * interrupted sync simply repeats next time.
 */
export async function runSync(backend: SyncBackend, cursor: SyncCursor, local: () => BackupData, now = Date.now()): Promise<SyncResult> {
  const startedAt = now;
  const outgoing = changedRows(local(), cursor.pushedAt);
  for (let i = 0; i < outgoing.length; i += BATCH) await backend.push(outgoing.slice(i, i + BATCH));

  const incoming: SyncRow[] = [];
  let seq = cursor.seq;
  for (;;) {
    const page = await backend.pull(seq, PAGE);
    incoming.push(...page);
    for (const r of page) seq = Math.max(seq, r.seq ?? seq);
    if (page.length < PAGE) break;
  }

  const next: SyncCursor = {
    seq,
    // Rows that came down must not be uploaded again, even if their device clock ran ahead of ours.
    pushedAt: Math.max(startedAt, newestChange(incoming)),
  };
  if (!incoming.length) return { cursor: next, pushed: outgoing.length, pulled: 0, merged: null };
  const merged = mergeData(local(), rowsToData(incoming));
  return { cursor: next, pushed: outgoing.length, pulled: incoming.length, merged };
}
