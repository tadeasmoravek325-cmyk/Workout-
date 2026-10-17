/**
 * Cloud account and background sync (Supabase).
 *
 * The app stays local-first: everything works offline and the phone keeps all data. When signed
 * in, changes are uploaded a few seconds after they happen and other devices' changes are merged
 * in on start, on focus, when the network comes back and every few minutes.
 *
 * Configured through VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Without them the account
 * features stay hidden. The client library is loaded only when needed.
 */
import { create } from 'zustand';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { exportBackup, useStore } from '../store/store';
import { useSafety } from './safety';
import { runSync, type SyncBackend, type SyncCursor } from './syncEngine';
import type { SyncRow } from './syncRows';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const cloudConfigured = Boolean(URL && KEY);

export type CloudStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error';

interface CloudState {
  status: CloudStatus;
  user: { id: string; email?: string } | null;
  lastSyncAt?: number;
  error?: string;
}

export const useCloud = create<CloudState>(() => ({ status: cloudConfigured ? 'signed-out' : 'off', user: null }));

let clientPromise: Promise<SupabaseClient> | null = null;
export function client(): Promise<SupabaseClient> {
  if (!cloudConfigured) return Promise.reject(new Error('Cloud sync is not configured'));
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL!, KEY!, {
      auth: {
        // PKCE returns ?code= instead of tokens in the #hash, which the hash router needs for itself.
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'gym-auth',
      },
    }),
  );
  return clientPromise;
}

/* ---------------- cursor per account ---------------- */

const cursorKey = (uid: string) => `gym-sync:${uid}`;
function loadCursor(uid: string): SyncCursor {
  try {
    const raw = localStorage.getItem(cursorKey(uid));
    if (raw) return JSON.parse(raw) as SyncCursor;
  } catch {
    /* fall through */
  }
  return { seq: 0, pushedAt: 0 };
}
function saveCursor(uid: string, c: SyncCursor) {
  try {
    localStorage.setItem(cursorKey(uid), JSON.stringify(c));
  } catch {
    /* the next sync just repeats some work */
  }
}

function backendFor(sb: SupabaseClient, uid: string): SyncBackend {
  return {
    async pull(afterSeq, limit) {
      const { data, error } = await sb
        .from('records')
        .select('collection,id,data,updated_at,deleted_at,seq')
        .eq('user_id', uid)
        .gt('seq', afterSeq)
        .order('seq', { ascending: true })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as SyncRow[];
    },
    async push(rows) {
      const { error } = await sb.rpc('sync_push', { items: rows });
      if (error) throw error;
    },
  };
}

/* ---------------- sync loop ---------------- */

let running: Promise<void> | null = null;
let again = false;

/** Syncs now. Calls made while a sync runs are folded into one more round. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce() {
  const user = useCloud.getState().user;
  if (!user || !useStore.getState().hydrated || useSafety.getState().loadError) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    useCloud.setState({ status: 'offline' });
    return;
  }
  useCloud.setState({ status: 'syncing', error: undefined });
  try {
    const sb = await client();
    const result = await runSync(backendFor(sb, user.id), loadCursor(user.id), exportBackup);
    if (result.merged) {
      applying = true;
      try {
        useStore.getState().applyRemote(result.merged);
      } finally {
        applying = false;
      }
    }
    saveCursor(user.id, result.cursor);
    useCloud.setState({ status: 'synced', lastSyncAt: Date.now() });
  } catch (e) {
    useCloud.setState({ status: 'error', error: (e as Error).message || String(e) });
  }
}

let applying = false;
let timer: ReturnType<typeof setTimeout> | undefined;
/** Debounced sync after local edits. */
function scheduleSync(ms = 3000) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), ms);
}

function setUser(u: User | null) {
  const prev = useCloud.getState().user?.id;
  useCloud.setState({ user: u ? { id: u.id, email: u.email ?? undefined } : null, status: u ? 'synced' : 'signed-out' });
  if (u && u.id !== prev) void syncNow();
}

let started = false;
/** Wires auth and the background sync triggers. Safe to call more than once. */
export async function startCloud() {
  if (!cloudConfigured || started) return;
  started = true;
  const sb = await client();
  sb.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
  const { data } = await sb.auth.getSession();
  setUser(data.session?.user ?? null);
  // A finished OAuth sign-in leaves ?code= in the address; clean it up.
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname + location.hash);

  useStore.subscribe((s, prev) => {
    if (applying || !useCloud.getState().user) return;
    if (
      s.workouts !== prev.workouts ||
      s.routines !== prev.routines ||
      s.customExercises !== prev.customExercises ||
      s.measurements !== prev.measurements ||
      s.settings !== prev.settings ||
      s.schedule !== prev.schedule ||
      s.exerciseNotes !== prev.exerciseNotes ||
      s.deleted !== prev.deleted
    )
      scheduleSync();
  });
  window.addEventListener('online', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  setInterval(() => void syncNow(), 5 * 60_000);
}

/* ---------------- account actions ---------------- */

export async function sendEmailCode(email: string) {
  const sb = await client();
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, token: string) {
  const sb = await client();
  const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
}

export async function signInWith(provider: 'google' | 'apple') {
  const sb = await client();
  const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + location.pathname } });
  if (error) throw error;
}

/** Signs out. Data stays on this phone. */
export async function signOut() {
  const sb = await client();
  await sb.auth.signOut();
}

/** Deletes the account and all cloud data (GDPR). Data on this phone is kept. */
export async function deleteAccount() {
  const sb = await client();
  const uid = useCloud.getState().user?.id;
  const { error } = await sb.rpc('delete_my_account');
  if (error) throw error;
  if (uid) localStorage.removeItem(cursorKey(uid));
  await sb.auth.signOut();
}
