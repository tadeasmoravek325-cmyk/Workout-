import { COLLECTIONS, tombKey, type Collection } from './sync';
import type { BackupData } from '../store/store';

/** One row of public.records (see supabase/migrations/0001_sync.sql). */
export interface SyncRow {
  collection: Collection | 'doc';
  id: string;
  data: unknown;
  updated_at: number;
  deleted_at?: number | null;
  seq?: number;
}

const DOCS = ['settings', 'schedule', 'notes'] as const;

/**
 * Local changes made after `since` (ms), as rows to upload. `since = 0` uploads everything,
 * including records from before change times existed.
 */
export function changedRows(data: BackupData, since: number): SyncRow[] {
  const rows: SyncRow[] = [];
  const fresh = (t: number | undefined) => since === 0 || (t ?? 0) > since;
  for (const c of COLLECTIONS) {
    for (const x of data[c] as { id: string; updatedAt?: number }[]) {
      if (fresh(x.updatedAt)) rows.push({ collection: c, id: x.id, data: x, updated_at: x.updatedAt ?? 0 });
    }
  }
  for (const [key, at] of Object.entries(data.deleted ?? {})) {
    if (!fresh(at)) continue;
    const i = key.indexOf(':');
    rows.push({ collection: key.slice(0, i) as Collection, id: key.slice(i + 1), data: null, updated_at: at, deleted_at: at });
  }
  if (fresh(data.settings.updatedAt)) rows.push({ collection: 'doc', id: 'settings', data: data.settings, updated_at: data.settings.updatedAt ?? 0 });
  if (fresh(data.scheduleUpdatedAt)) rows.push({ collection: 'doc', id: 'schedule', data: data.schedule, updated_at: data.scheduleUpdatedAt ?? 0 });
  if (fresh(data.notesUpdatedAt)) rows.push({ collection: 'doc', id: 'notes', data: data.exerciseNotes ?? {}, updated_at: data.notesUpdatedAt ?? 0 });
  return rows;
}

/** Rows from the server as a partial copy of the data, ready for mergeData. */
export function rowsToData(rows: SyncRow[]): Partial<BackupData> {
  const out: Partial<BackupData> = { deleted: {} };
  for (const c of COLLECTIONS) (out as Record<string, unknown[]>)[c] = [];
  for (const r of rows) {
    if (r.collection === 'doc') {
      if (!DOCS.includes(r.id as (typeof DOCS)[number]) || r.data == null) continue;
      if (r.id === 'settings') out.settings = { ...(r.data as BackupData['settings']), updatedAt: r.updated_at };
      if (r.id === 'schedule') {
        out.schedule = r.data as BackupData['schedule'];
        out.scheduleUpdatedAt = r.updated_at;
      }
      if (r.id === 'notes') {
        out.exerciseNotes = r.data as Record<string, string>;
        out.notesUpdatedAt = r.updated_at;
      }
      continue;
    }
    if (!COLLECTIONS.includes(r.collection)) continue;
    if (r.deleted_at != null) {
      const k = tombKey(r.collection, r.id);
      out.deleted![k] = Math.max(out.deleted![k] ?? 0, r.deleted_at);
      continue;
    }
    if (r.data && typeof r.data === 'object') {
      (out as Record<string, unknown[]>)[r.collection].push({ ...(r.data as object), id: r.id, updatedAt: r.updated_at });
    }
  }
  return out;
}

/** Newest change time among rows, so they are not uploaded straight back. */
export function newestChange(rows: SyncRow[]): number {
  let t = 0;
  for (const r of rows) t = Math.max(t, r.updated_at ?? 0, r.deleted_at ?? 0);
  return t;
}
