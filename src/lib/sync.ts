/**
 * Sync-ready data model.
 *
 * Every record carries `updatedAt`, and deletions leave a tombstone (`deleted["workouts:<id>"] = time`).
 * Two copies of the data (two devices, a backup and this phone, later the server) can then be merged
 * without losing anything: per record the newer edit wins, and a deletion wins over any edit made
 * before it. Records from before this model have no `updatedAt` and count as time 0.
 */

export type Collection = 'workouts' | 'routines' | 'customExercises' | 'measurements';
export const COLLECTIONS: Collection[] = ['workouts', 'routines', 'customExercises', 'measurements'];

/** Tombstones are dropped after this long; by then every device has long synced. */
export const TOMBSTONE_TTL = 400 * 86_400_000;

export interface Stamped {
  id: string;
  updatedAt?: number;
}

export interface SyncData {
  workouts: Stamped[];
  routines: Stamped[];
  customExercises: Stamped[];
  measurements: Stamped[];
  settings: { updatedAt?: number };
  schedule: Record<number, string | undefined>;
  scheduleUpdatedAt?: number;
  exerciseNotes?: Record<string, string>;
  notesUpdatedAt?: number;
  deleted?: Record<string, number>;
}

let last = 0;
/** Strictly increasing timestamp, so two edits in the same millisecond still order correctly. */
export function stampNow(): number {
  last = Math.max(Date.now(), last + 1);
  return last;
}

export function tombKey(c: Collection, id: string): string {
  return `${c}:${id}`;
}

export function stamp<T extends object>(x: T, at = stampNow()): T & { updatedAt: number } {
  return { ...x, updatedAt: at };
}

/** Adds tombstones for `ids` and returns the new map. */
export function withTombstones(deleted: Record<string, number> | undefined, c: Collection, ids: string[], at = stampNow()): Record<string, number> {
  const out = { ...(deleted ?? {}) };
  for (const id of ids) out[tombKey(c, id)] = at;
  return out;
}

/** Removes a tombstone, e.g. when a deleted record is restored with undo. */
export function withoutTombstone(deleted: Record<string, number> | undefined, c: Collection, id: string): Record<string, number> {
  const k = tombKey(c, id);
  if (!deleted || !(k in deleted)) return deleted ?? {};
  const out = { ...deleted };
  delete out[k];
  return out;
}

export function pruneTombstones(deleted: Record<string, number> | undefined, now = Date.now()): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, at] of Object.entries(deleted ?? {})) if (now - at < TOMBSTONE_TTL) out[k] = at;
  return out;
}

function mergeCollection<T extends Stamped>(c: Collection, a: T[], b: T[], deleted: Record<string, number>): T[] {
  const map = new Map<string, T>();
  for (const x of a) map.set(x.id, x);
  for (const x of b) {
    const cur = map.get(x.id);
    // Ties go to the incoming copy, matching how a backup merge always behaved.
    if (!cur || (x.updatedAt ?? 0) >= (cur.updatedAt ?? 0)) map.set(x.id, x);
  }
  const out: T[] = [];
  for (const x of map.values()) {
    const del = deleted[tombKey(c, x.id)];
    if (del !== undefined && del >= (x.updatedAt ?? 0)) continue;
    out.push(x);
  }
  return out;
}

/**
 * Merges `remote` into `local`. Pure and symmetric apart from ties, which go to `remote`.
 * Settings, the weekly schedule and pinned notes are small, so each is taken whole from the newer side.
 */
export function mergeData<D extends SyncData>(local: D, remote: Partial<D>): D {
  const deleted: Record<string, number> = { ...(local.deleted ?? {}) };
  for (const [k, at] of Object.entries((remote.deleted ?? {}) as Record<string, number>)) deleted[k] = Math.max(deleted[k] ?? 0, at);
  const out = { ...local, deleted } as D;
  for (const c of COLLECTIONS) {
    (out as SyncData)[c] = mergeCollection(c, local[c] ?? [], (remote[c] as Stamped[] | undefined) ?? [], deleted);
  }
  if (remote.settings && (remote.settings.updatedAt ?? 0) >= (local.settings.updatedAt ?? 0)) {
    out.settings = { ...local.settings, ...remote.settings };
  }
  if (remote.schedule && (remote.scheduleUpdatedAt ?? 0) >= (local.scheduleUpdatedAt ?? 0)) {
    out.schedule = remote.schedule;
    out.scheduleUpdatedAt = remote.scheduleUpdatedAt ?? local.scheduleUpdatedAt;
  }
  if (remote.exerciseNotes) {
    if ((remote.notesUpdatedAt ?? 0) >= (local.notesUpdatedAt ?? 0)) {
      // Older files had no timestamp: keep notes from both sides rather than dropping any.
      out.exerciseNotes = remote.notesUpdatedAt ? remote.exerciseNotes : { ...(local.exerciseNotes ?? {}), ...remote.exerciseNotes };
      out.notesUpdatedAt = remote.notesUpdatedAt ?? local.notesUpdatedAt;
    }
  }
  return out;
}

/**
 * Merge for restoring a backup: like mergeData, but records the user deleted here after the backup
 * was made come back. Restoring a backup is an explicit "I want this data", so it beats local deletions.
 */
export function mergeBackup<D extends SyncData>(local: D, backup: Partial<D>): D {
  const present = new Set<string>();
  for (const c of COLLECTIONS) for (const x of (backup[c] as Stamped[] | undefined) ?? []) present.add(tombKey(c, x.id));
  const deleted: Record<string, number> = {};
  for (const [k, at] of Object.entries(local.deleted ?? {})) if (!present.has(k)) deleted[k] = at;
  return mergeData({ ...local, deleted }, backup);
}
