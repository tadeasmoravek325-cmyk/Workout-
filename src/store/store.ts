import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createSnapshot, finishLoad, maybeDailySnapshot, onOtherTabSaved, requestPersistence, safeStorage, STORE_KEY } from '../lib/safety';
import type {
  Exercise,
  Measurement,
  RestTimer,
  Routine,
  RoutineExercise,
  Settings,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../types';
import { defaultSettings, startOfWeek, uid } from '../lib/calc';
import { BUILTIN_EXERCISES, normalizeMuscles } from '../data/exercises';
import { LOCALE_TAG, t } from '../i18n';
import { PROGRAMS } from '../data/programs';
import { mergeBackup, pruneTombstones, stamp, stampNow, withoutTombstone, withTombstones, type Collection } from '../lib/sync';

/** Monday = 0 … Sunday = 6 → routine id. */
export type Schedule = Record<number, string | undefined>;

export interface BackupData {
  workouts: Workout[];
  routines: Routine[];
  customExercises: Exercise[];
  measurements: Measurement[];
  settings: Settings;
  schedule: Schedule;
  /** Pinned per-exercise notes shown every time the exercise is performed. */
  exerciseNotes?: Record<string, string>;
  scheduleUpdatedAt?: number;
  notesUpdatedAt?: number;
  /** Tombstones "collection:id" → deletion time, so merges never bring deleted records back. */
  deleted?: Record<string, number>;
}

interface State extends BackupData {
  hydrated: boolean;
  active: Workout | null;
  rest: RestTimer | null;

  startWorkout: (routine?: Routine) => void;
  mutateActive: (fn: (w: Workout) => void) => void;
  discardWorkout: () => void;
  /** Removes unfinished sets and empty exercises, stores the workout and returns its id. */
  finishWorkout: () => string | null;

  mutateWorkout: (id: string, fn: (w: Workout) => void) => void;
  deleteWorkout: (id: string) => void;
  restoreWorkout: (w: Workout) => void;
  restoreActive: (w: Workout) => void;

  saveRoutine: (r: Routine) => void;
  deleteRoutine: (id: string) => void;
  routineFromWorkout: (workoutId: string, name?: string) => string | null;
  updateRoutineFromWorkout: (workoutId: string) => void;
  importProgram: (programId: string) => number;

  saveExercise: (e: Exercise) => void;
  deleteExercise: (id: string) => void;

  addMeasurement: (m: Omit<Measurement, 'id'>) => void;
  deleteMeasurement: (id: string) => void;
  restoreMeasurement: (m: Measurement) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  setSchedule: (day: number, routineId: string | undefined) => void;
  setExerciseNote: (exerciseId: string, note: string) => void;

  startRest: (sec: number) => void;
  adjustRest: (deltaSec: number) => void;
  stopRest: () => void;

  importBackup: (data: Partial<BackupData>, mode: 'merge' | 'replace') => void;
  /**
   * Adds imported workouts. Workouts starting at the same moment as an existing one are skipped,
   * or, with `replace`, the existing ones are removed first (fixes an earlier bad import).
   */
  importWorkouts: (workouts: Workout[], exercises: Exercise[], replace?: boolean) => number;
  resetAll: () => void;
  /** Replaces synced data with a merged copy from the cloud. Keeps the active workout and timers. */
  applyRemote: (data: BackupData) => void;
}

function blankSet(type: WorkoutSet['type'] = 'normal'): WorkoutSet {
  return { id: uid(), type, done: false };
}

export function newWorkoutExercise(exerciseId: string, setCount = 3): WorkoutExercise {
  return { id: uid(), exerciseId, sets: Array.from({ length: setCount }, () => blankSet()) };
}

export function newSet(prev?: WorkoutSet): WorkoutSet {
  return {
    ...blankSet(prev?.type === 'warmup' ? 'normal' : (prev?.type ?? 'normal')),
    weight: prev?.weight,
    reps: prev?.reps,
    durationSec: prev?.durationSec,
    distance: prev?.distance,
  };
}

function workoutFromRoutine(r: Routine): Workout {
  return {
    id: uid(),
    name: r.name,
    startedAt: Date.now(),
    routineId: r.id,
    notes: '',
    exercises: r.exercises.map((re) => ({
      id: uid(),
      exerciseId: re.exerciseId,
      restSec: re.restSec,
      supersetId: re.supersetId,
      notes: re.notes,
      sets: re.sets.map((s) => ({ id: uid(), done: false, ...s })),
    })),
  };
}

function defaultWorkoutName(ts = Date.now()): string {
  const h = new Date(ts).getHours();
  if (h < 11) return t('Morning workout');
  if (h < 14) return t('Midday workout');
  if (h < 18) return t('Afternoon workout');
  return t('Evening workout');
}

function routineExercisesFromWorkout(w: Workout): RoutineExercise[] {
  return w.exercises.map((we) => ({
    id: uid(),
    exerciseId: we.exerciseId,
    restSec: we.restSec,
    supersetId: we.supersetId,
    notes: we.notes,
    sets: we.sets.map((s) => ({
      type: s.type,
      weight: s.weight,
      reps: s.reps,
      durationSec: s.durationSec,
      distance: s.distance,
    })),
  }));
}

const initialData = (): BackupData => ({
  workouts: [],
  routines: [],
  customExercises: [],
  measurements: [],
  settings: defaultSettings(),
  schedule: {},
  exerciseNotes: {},
  deleted: {},
});

/** Tombstones for every record, so a reset also wins over older copies when merging. */
function tombstonesForAll(s: BackupData): Record<string, number> {
  const at = stampNow();
  let d = s.deleted ?? {};
  const all: [Collection, { id: string }[]][] = [
    ['workouts', s.workouts],
    ['routines', s.routines],
    ['customExercises', s.customExercises],
    ['measurements', s.measurements],
  ];
  for (const [c, items] of all) d = withTombstones(d, c, items.map((x) => x.id), at);
  return d;
}

export const useStore = create<State>()(
  persist(
    (setState, getState) => ({
      ...initialData(),
      hydrated: false,
      active: null,
      rest: null,

      startWorkout: (routine) => {
        if (getState().active) return;
        const w: Workout = routine
          ? workoutFromRoutine(routine)
          : { id: uid(), name: defaultWorkoutName(), startedAt: Date.now(), exercises: [], notes: '' };
        setState({ active: w });
      },

      mutateActive: (fn) => {
        const a = getState().active;
        if (!a) return;
        const copy = structuredClone(a);
        fn(copy);
        setState({ active: copy });
      },

      discardWorkout: () => setState({ active: null, rest: null }),

      finishWorkout: () => {
        const a = getState().active;
        if (!a) return null;
        const w = structuredClone(a);
        w.finishedAt = Date.now();
        w.updatedAt = stampNow();
        w.exercises = w.exercises
          .map((we) => ({ ...we, sets: we.sets.filter((s) => s.done) }))
          .filter((we) => we.sets.length > 0);
        if (!w.exercises.length) {
          setState({ active: null, rest: null });
          return null;
        }
        setState((s) => ({
          active: null,
          rest: null,
          workouts: [w, ...s.workouts].sort((a, b) => b.startedAt - a.startedAt),
        }));
        return w.id;
      },

      mutateWorkout: (id, fn) =>
        setState((s) => ({
          workouts: s.workouts
            .map((w) => {
              if (w.id !== id) return w;
              const copy = structuredClone(w);
              fn(copy);
              copy.updatedAt = stampNow();
              return copy;
            })
            .sort((a, b) => b.startedAt - a.startedAt),
        })),

      deleteWorkout: (id) =>
        setState((s) => ({ workouts: s.workouts.filter((w) => w.id !== id), deleted: withTombstones(s.deleted, 'workouts', [id]) })),

      restoreWorkout: (w) =>
        setState((s) => ({
          workouts: [stamp(w), ...s.workouts.filter((x) => x.id !== w.id)].sort((a, b) => b.startedAt - a.startedAt),
          deleted: withoutTombstone(s.deleted, 'workouts', w.id),
        })),

      restoreActive: (w) => {
        if (!getState().active) setState({ active: w });
      },

      saveRoutine: (r) =>
        setState((s) => {
          const exists = s.routines.some((x) => x.id === r.id);
          const saved = stamp(r);
          return {
            routines: exists ? s.routines.map((x) => (x.id === r.id ? saved : x)) : [...s.routines, saved],
            deleted: withoutTombstone(s.deleted, 'routines', r.id),
          };
        }),

      deleteRoutine: (id) =>
        setState((s) => {
          const schedule = { ...s.schedule };
          let changed = false;
          for (const k of Object.keys(schedule))
            if (schedule[+k] === id) {
              delete schedule[+k];
              changed = true;
            }
          return {
            routines: s.routines.filter((r) => r.id !== id),
            schedule,
            ...(changed ? { scheduleUpdatedAt: stampNow() } : {}),
            deleted: withTombstones(s.deleted, 'routines', [id]),
          };
        }),

      routineFromWorkout: (workoutId, name) => {
        const w = getState().workouts.find((x) => x.id === workoutId);
        if (!w) return null;
        const r: Routine = {
          id: uid(),
          name: name ?? w.name,
          notes: '',
          createdAt: Date.now(),
          exercises: routineExercisesFromWorkout(w),
        };
        getState().saveRoutine(r);
        getState().mutateWorkout(workoutId, (x) => {
          x.routineId = r.id;
        });
        return r.id;
      },

      updateRoutineFromWorkout: (workoutId) => {
        const s = getState();
        const w = s.workouts.find((x) => x.id === workoutId);
        const r = w?.routineId && s.routines.find((x) => x.id === w.routineId);
        if (!w || !r) return;
        // Keep warm-ups and set structure, take the latest weights and reps.
        s.saveRoutine({ ...r, exercises: routineExercisesFromWorkout(w) });
      },

      importProgram: (programId) => {
        const p = PROGRAMS.find((x) => x.id === programId);
        if (!p) return 0;
        const all = [...BUILTIN_EXERCISES, ...getState().customExercises];
        const at = stampNow();
        const routines: Routine[] = p.days.map((d) => ({
          updatedAt: at,
          id: uid(),
          name: d.name,
          folder: p.name,
          notes: '',
          createdAt: Date.now(),
          exercises: d.exercises.map((pe) => {
            const ex = all.find((e) => e.id === pe.exerciseId);
            const isTime = ex?.type === 'duration';
            return {
              id: uid(),
              exerciseId: pe.exerciseId,
              restSec: pe.restSec,
              sets: Array.from({ length: pe.sets }, () => ({
                type: 'normal' as const,
                reps: isTime ? undefined : pe.reps || undefined,
                durationSec: isTime ? (pe.durationSec ?? 45) : undefined,
              })),
            };
          }),
        }));
        setState((s) => ({ routines: [...s.routines, ...routines] }));
        return routines.length;
      },

      saveExercise: (e) =>
        setState((s) => {
          const exists = s.customExercises.some((x) => x.id === e.id);
          const custom = stamp({ ...e, custom: true });
          return {
            customExercises: exists ? s.customExercises.map((x) => (x.id === e.id ? custom : x)) : [...s.customExercises, custom],
            deleted: withoutTombstone(s.deleted, 'customExercises', e.id),
          };
        }),

      deleteExercise: (id) =>
        setState((s) => ({
          customExercises: s.customExercises.filter((e) => e.id !== id),
          deleted: withTombstones(s.deleted, 'customExercises', [id]),
        })),

      addMeasurement: (m) =>
        setState((s) => ({ measurements: [...s.measurements, stamp({ ...m, id: uid() })].sort((a, b) => a.date - b.date) })),

      deleteMeasurement: (id) =>
        setState((s) => ({
          measurements: s.measurements.filter((m) => m.id !== id),
          deleted: withTombstones(s.deleted, 'measurements', [id]),
        })),

      restoreMeasurement: (m) =>
        setState((s) => ({
          measurements: [...s.measurements.filter((x) => x.id !== m.id), stamp(m)].sort((a, b) => a.date - b.date),
          deleted: withoutTombstone(s.deleted, 'measurements', m.id),
        })),

      updateSettings: (patch) =>
        setState((s) => {
          const next = { ...s.settings, ...patch, updatedAt: stampNow() };
          // With no history yet (e.g. onboarding) there is nothing to protect, and pinning the default
          // would later judge imported weeks by a goal the user never chose.
          if (patch.weeklyGoal !== undefined && patch.weeklyGoal !== s.settings.weeklyGoal && s.workouts.length) {
            next.goalLog = logGoalChange(s.settings.goalLog, s.settings.weeklyGoal, patch.weeklyGoal);
          }
          return { settings: next };
        }),

      setSchedule: (day, routineId) => setState((s) => ({ schedule: { ...s.schedule, [day]: routineId }, scheduleUpdatedAt: stampNow() })),

      setExerciseNote: (exerciseId, note) =>
        setState((s) => {
          const notes = { ...(s.exerciseNotes ?? {}) };
          if (note.trim()) notes[exerciseId] = note;
          else delete notes[exerciseId];
          return { exerciseNotes: notes, notesUpdatedAt: stampNow() };
        }),

      startRest: (sec) => {
        if (sec <= 0) return setState({ rest: null });
        const now = Date.now();
        setState({ rest: { startedAt: now, endsAt: now + sec * 1000, durationSec: sec } });
      },

      adjustRest: (delta) => {
        const r = getState().rest;
        if (!r) return;
        const endsAt = r.endsAt + delta * 1000;
        if (endsAt <= Date.now()) return setState({ rest: null });
        setState({ rest: { ...r, endsAt, durationSec: Math.max(1, r.durationSec + delta) } });
      },

      stopRest: () => setState({ rest: null }),

      importBackup: (data, mode) => {
        void createSnapshot('before-import', exportBackup());
        setState(() => {
          if (mode === 'replace') {
            return {
              ...initialData(),
              ...data,
              settings: { ...defaultSettings(), ...(data.settings ?? {}) },
            };
          }
          // Merge by record so nothing is duplicated and newer edits win. Records deleted here
          // after the backup was made come back: restoring a backup means wanting that data.
          const merged = mergeBackup(exportBackup(), data);
          return {
            ...merged,
            workouts: [...merged.workouts].sort((a, b) => b.startedAt - a.startedAt),
            measurements: [...merged.measurements].sort((a, b) => a.date - b.date),
            settings: { ...defaultSettings(), ...merged.settings },
          };
        });
      },

      importWorkouts: (workouts, exercises, replace = false) => {
        void createSnapshot('before-import', exportBackup());
        const s = getState();
        const incoming = new Set(workouts.map((w) => w.startedAt));
        const kept = replace ? s.workouts.filter((w) => !incoming.has(w.startedAt)) : s.workouts;
        const removed = s.workouts.filter((w) => !kept.includes(w)).map((w) => w.id);
        const existing = new Set(kept.map((w) => w.startedAt));
        const at = stampNow();
        const fresh = workouts.filter((w) => !existing.has(w.startedAt)).map((w) => stamp(w, at));
        const knownEx = new Set(s.customExercises.map((e) => e.id));
        setState({
          workouts: [...kept, ...fresh].sort((a, b) => b.startedAt - a.startedAt),
          customExercises: [...s.customExercises, ...exercises.filter((e) => !knownEx.has(e.id)).map((e) => stamp(e, at))],
          deleted: removed.length ? withTombstones(s.deleted, 'workouts', removed, at) : s.deleted,
        });
        return fresh.length;
      },

      applyRemote: (data) =>
        setState({
          workouts: [...data.workouts].sort((a, b) => b.startedAt - a.startedAt),
          routines: data.routines,
          customExercises: data.customExercises,
          measurements: [...data.measurements].sort((a, b) => a.date - b.date),
          settings: { ...defaultSettings(), ...data.settings },
          schedule: data.schedule,
          scheduleUpdatedAt: data.scheduleUpdatedAt,
          exerciseNotes: data.exerciseNotes,
          notesUpdatedAt: data.notesUpdatedAt,
          deleted: data.deleted,
        }),

      resetAll: () => {
        void createSnapshot('before-reset', exportBackup());
        const deleted = tombstonesForAll(exportBackup());
        setState({ ...initialData(), deleted, active: null, rest: null });
      },
    }),
    {
      // Storage key kept from the original working name so existing data is not lost.
      name: STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      // Future schema changes go here. Returning the state untouched keeps data instead of dropping it.
      migrate: (persisted) => persisted as State,
      partialize: (s) => ({
        workouts: s.workouts,
        routines: s.routines,
        customExercises: s.customExercises,
        measurements: s.measurements,
        settings: s.settings,
        schedule: s.schedule,
        exerciseNotes: s.exerciseNotes,
        scheduleUpdatedAt: s.scheduleUpdatedAt,
        notesUpdatedAt: s.notesUpdatedAt,
        deleted: s.deleted,
        active: s.active,
        rest: s.rest,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const settings = { ...defaultSettings(), ...(p.settings ?? {}) };
        // Existing users who already have history skip onboarding.
        if (!p.settings?.onboarded && (p.workouts?.length ?? 0) > 0) settings.onboarded = true;
        return { ...current, ...p, settings, deleted: pruneTombstones(p.deleted) };
      },
      onRehydrateStorage: () => (_state, error) => {
        finishLoad(error);
        useStore.setState({ hydrated: true });
        if (!error) {
          void requestPersistence();
          void maybeDailySnapshot(exportBackup());
        }
      },
    },
  ),
);

/** Built-in plus custom exercises. */
/**
 * Records a weekly-goal change from this week on. The first change also pins the old goal
 * for all earlier weeks, so history keeps the goal it was earned under.
 */
export function logGoalChange(log: [number, number][] | undefined, oldGoal: number, newGoal: number, now = Date.now()): [number, number][] {
  const week = startOfWeek(now);
  const out: [number, number][] = log?.length ? log.filter(([w]) => w < week) : [[0, oldGoal]];
  out.push([week, newGoal]);
  return out;
}

export function useAllExercises(): Exercise[] {
  const custom = useStore((s) => s.customExercises);
  return useMemoExercises(custom);
}

let cacheKey: Exercise[] | null = null;
let cacheVal: Exercise[] = BUILTIN_EXERCISES;
function useMemoExercises(custom: Exercise[]): Exercise[] {
  if (cacheKey !== custom) {
    cacheKey = custom;
    // Custom exercises may predate the detailed muscle list ('shoulders'), so normalise them on read.
    const fixed = custom.map((e) => ({ ...e, primary: normalizeMuscles(e.primary), secondary: normalizeMuscles(e.secondary) }));
    cacheVal = [...BUILTIN_EXERCISES, ...fixed].sort((a, b) => a.name.localeCompare(b.name, LOCALE_TAG));
  }
  return cacheVal;
}

export function useExerciseMap(): Map<string, Exercise> {
  const all = useAllExercises();
  return getMap(all);
}

let mapKey: Exercise[] | null = null;
let mapVal = new Map<string, Exercise>();
function getMap(all: Exercise[]): Map<string, Exercise> {
  if (mapKey !== all) {
    mapKey = all;
    mapVal = new Map(all.map((e) => [e.id, e]));
  }
  return mapVal;
}

export function exportBackup(): BackupData {
  const s = useStore.getState();
  return {
    workouts: s.workouts,
    routines: s.routines,
    customExercises: s.customExercises,
    measurements: s.measurements,
    settings: s.settings,
    schedule: s.schedule,
    exerciseNotes: s.exerciseNotes,
    scheduleUpdatedAt: s.scheduleUpdatedAt,
    notesUpdatedAt: s.notesUpdatedAt,
    deleted: s.deleted,
  };
}

// Another tab saved newer data: re-read it so this tab never writes stale state over it.
onOtherTabSaved(() => {
  void useStore.persist.rehydrate();
});
