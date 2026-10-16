/**
 * Data safety: guarded storage, automatic snapshots, cross-tab sync and backup files.
 *
 * Rules this module enforces:
 * - Nothing is written until the stored data has been read successfully, so a failed or
 *   corrupted load can never be overwritten by an empty state.
 * - Unreadable data is copied aside ("quarantine") before anything else happens.
 * - Snapshots of the whole dataset are kept automatically (daily and before risky operations).
 */
import { create } from 'zustand';
import { del, get, set } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';
import { t } from '../i18n';

export const STORE_KEY = 'silak-data';
const SNAPSHOT_INDEX = 'gym-snapshots';
const SNAPSHOT_PREFIX = 'gym-snapshot:';
const QUARANTINE_PREFIX = 'gym-quarantine:';
export const BACKUP_APP_ID = 'gym-tracker';
export const BACKUP_SCHEMA = 1;

interface SafetyState {
  /** Writes stay blocked until the first successful load. */
  writesAllowed: boolean;
  loadError: string | null;
  saveError: string | null;
  lastSavedAt: number | null;
  /** Result of navigator.storage.persist(); null = unknown/unsupported. */
  persistent: boolean | null;
}

export const useSafety = create<SafetyState>(() => ({
  writesAllowed: false,
  loadError: null,
  saveError: null,
  lastSavedAt: null,
  persistent: null,
}));

/* ------------------------------------------------------------------ */
/* Cross-tab sync                                                      */
/* ------------------------------------------------------------------ */

const tabId = Math.random().toString(36).slice(2);
const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('gym-sync') : null;
let onRemoteChange: (() => void) | null = null;

channel?.addEventListener('message', (e: MessageEvent<{ type: string; from: string }>) => {
  if (e.data?.type === 'saved' && e.data.from !== tabId) onRemoteChange?.();
});

/** Called when another tab saved newer data; the store re-reads it. */
export function onOtherTabSaved(cb: () => void) {
  onRemoteChange = cb;
}

/* ------------------------------------------------------------------ */
/* Guarded storage for zustand persist                                 */
/* ------------------------------------------------------------------ */

export const safeStorage: StateStorage = {
  getItem: async (name) => {
    let raw: string | undefined;
    try {
      raw = await get<string>(name);
    } catch (e) {
      throw new Error(t("Couldn't read the browser storage ({error}).", { error: String((e as Error).message || e) }));
    }
    if (raw == null) return null;
    try {
      JSON.parse(raw);
    } catch {
      // Keep the unreadable original so it can still be recovered by hand.
      try {
        await set(QUARANTINE_PREFIX + Date.now(), raw);
      } catch {
        /* ignore */
      }
      throw new Error(t('The saved data is damaged. The original copy was set aside.'));
    }
    return raw;
  },
  setItem: async (name, value) => {
    if (!useSafety.getState().writesAllowed) return;
    try {
      await set(name, value);
      useSafety.setState({ saveError: null, lastSavedAt: Date.now() });
      channel?.postMessage({ type: 'saved', from: tabId });
    } catch (e) {
      const err = e as Error;
      const quota = err?.name === 'QuotaExceededError' || /quota/i.test(err?.message ?? '');
      useSafety.setState({
        saveError: quota
          ? t('Your device is out of space for app data. Free up some space or download a backup.')
          : t("Couldn't save your changes ({error}).", { error: String(err?.message || e) }),
      });
    }
  },
  removeItem: async (name) => {
    if (!useSafety.getState().writesAllowed) return;
    await del(name);
  },
};

/** Marks the load as successful (writes are allowed from now on) or failed. */
export function finishLoad(error?: unknown) {
  if (error) {
    useSafety.setState({ writesAllowed: false, loadError: (error as Error)?.message ?? String(error) });
  } else {
    useSafety.setState({ writesAllowed: true, loadError: null });
  }
}

/** Asks the browser not to evict our data under storage pressure. */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    const already = await navigator.storage.persisted();
    const ok = already || (await navigator.storage.persist());
    useSafety.setState({ persistent: ok });
    return ok;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Snapshots                                                           */
/* ------------------------------------------------------------------ */

export type SnapshotReason = 'daily' | 'before-import' | 'before-reset' | 'before-restore' | 'manual';

export interface SnapshotMeta {
  id: string;
  at: number;
  reason: SnapshotReason;
  workouts: number;
  bytes: number;
}

const KEEP_DAILY = 7;
const KEEP_OTHER = 10;

export const SNAPSHOT_REASON_LABELS: Record<SnapshotReason, string> = {
  daily: 'Daily restore point',
  'before-import': 'Before import',
  'before-reset': 'Before deleting data',
  'before-restore': 'Before restoring a backup',
  manual: 'Manual restore point',
};

export async function listSnapshots(): Promise<SnapshotMeta[]> {
  try {
    return ((await get<SnapshotMeta[]>(SNAPSHOT_INDEX)) ?? []).sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

export async function createSnapshot(reason: SnapshotReason, data: { workouts: unknown[] }): Promise<SnapshotMeta | null> {
  try {
    const json = JSON.stringify(data);
    const meta: SnapshotMeta = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(),
      reason,
      workouts: data.workouts.length,
      bytes: json.length,
    };
    await set(SNAPSHOT_PREFIX + meta.id, json);
    const all = [meta, ...(await listSnapshots())];
    const daily = all.filter((s) => s.reason === 'daily').slice(0, KEEP_DAILY);
    const other = all.filter((s) => s.reason !== 'daily').slice(0, KEEP_OTHER);
    const keep = new Set([...daily, ...other].map((s) => s.id));
    for (const s of all) if (!keep.has(s.id)) await del(SNAPSHOT_PREFIX + s.id);
    await set(
      SNAPSHOT_INDEX,
      all.filter((s) => keep.has(s.id)),
    );
    return meta;
  } catch {
    return null;
  }
}

export async function readSnapshot(id: string): Promise<unknown | null> {
  try {
    const raw = await get<string>(SNAPSHOT_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** One automatic snapshot per day, only once there is something worth keeping. */
export async function maybeDailySnapshot(data: { workouts: unknown[]; routines: unknown[]; measurements: unknown[] }) {
  if (!data.workouts.length && !data.routines.length && !data.measurements.length) return;
  const last = (await listSnapshots()).find((s) => s.reason === 'daily');
  if (last && Date.now() - last.at < 20 * 3_600_000) return;
  await createSnapshot('daily', data);
}

/**
 * Restores a snapshot while the app cannot load its data: writes it straight into the main key.
 * The current (unreadable) value has already been quarantined by getItem.
 */
export async function restoreSnapshotRaw(id: string): Promise<boolean> {
  const data = await readSnapshot(id);
  if (!data) return false;
  try {
    await set(STORE_KEY, JSON.stringify({ state: data, version: 1 }));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Backup files                                                        */
/* ------------------------------------------------------------------ */

export interface BackupFile<T> {
  app: string;
  schema: number;
  exportedAt: string;
  data: T;
}

export function makeBackupFile<T>(data: T): string {
  const file: BackupFile<T> = { app: BACKUP_APP_ID, schema: BACKUP_SCHEMA, exportedAt: new Date().toISOString(), data };
  return JSON.stringify(file);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Validates a backup (new wrapped format or the older bare format).
 * Returns the inner data or a human readable error. Never throws.
 */
export function parseBackup(text: string): { ok: true; data: Record<string, unknown>; exportedAt?: string } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: t("This file isn't valid JSON. Did you pick the right backup file?") };
  }
  let data: unknown = json;
  let exportedAt: string | undefined;
  if (isObj(json) && json.app === BACKUP_APP_ID) {
    if (typeof json.schema === 'number' && json.schema > BACKUP_SCHEMA) {
      return { ok: false, error: t('This backup is from a newer version of the app. Update the app and try again.') };
    }
    data = json.data;
    exportedAt = typeof json.exportedAt === 'string' ? json.exportedAt : undefined;
  }
  if (!isObj(data) || !Array.isArray(data.workouts)) {
    return { ok: false, error: t("There are no workouts in this file. It doesn't look like a backup from this app.") };
  }
  for (const [i, w] of (data.workouts as unknown[]).entries()) {
    if (!isObj(w) || typeof w.id !== 'string' || typeof w.startedAt !== 'number' || !Array.isArray(w.exercises)) {
      return { ok: false, error: t('Workout #{num} in the backup is damaged. Nothing was changed.', { num: i + 1 }) };
    }
    for (const e of w.exercises as unknown[]) {
      if (!isObj(e) || typeof e.exerciseId !== 'string' || !Array.isArray(e.sets)) {
        return { ok: false, error: t('Workout #{num} contains a damaged exercise. Nothing was changed.', { num: i + 1 }) };
      }
    }
  }
  for (const key of ['routines', 'customExercises', 'measurements'] as const) {
    if (data[key] !== undefined && !Array.isArray(data[key])) {
      return { ok: false, error: t('The backup has an unexpected format. Nothing was changed.') };
    }
  }
  return { ok: true, data, exportedAt };
}

/**
 * Hands a file to the user: the share sheet on phones (save to Files/Drive, send to yourself),
 * otherwise a regular download.
 */
export async function saveFile(name: string, content: string, type: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = new Blob([content], { type });
  try {
    const file = new File([blob], name, { type });
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    if (coarse && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'cancelled';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
