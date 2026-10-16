import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { del, get, set } from 'idb-keyval';
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
import { defaultSettings, uid } from '../lib/calc';
import { BUILTIN_EXERCISES } from '../data/exercises';
import { PROGRAMS } from '../data/programs';

const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: async (name, value) => set(name, value),
  removeItem: async (name) => del(name),
};

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

  saveRoutine: (r: Routine) => void;
  deleteRoutine: (id: string) => void;
  routineFromWorkout: (workoutId: string, name?: string) => string | null;
  updateRoutineFromWorkout: (workoutId: string) => void;
  importProgram: (programId: string) => number;

  saveExercise: (e: Exercise) => void;
  deleteExercise: (id: string) => void;

  addMeasurement: (m: Omit<Measurement, 'id'>) => void;
  deleteMeasurement: (id: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  setSchedule: (day: number, routineId: string | undefined) => void;
  setExerciseNote: (exerciseId: string, note: string) => void;

  startRest: (sec: number) => void;
  adjustRest: (deltaSec: number) => void;
  stopRest: () => void;

  importBackup: (data: Partial<BackupData>, mode: 'merge' | 'replace') => void;
  importWorkouts: (workouts: Workout[], exercises: Exercise[]) => number;
  resetAll: () => void;
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
  if (h < 11) return 'Ranní trénink';
  if (h < 14) return 'Polední trénink';
  if (h < 18) return 'Odpolední trénink';
  return 'Večerní trénink';
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
});

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
              return copy;
            })
            .sort((a, b) => b.startedAt - a.startedAt),
        })),

      deleteWorkout: (id) => setState((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),

      saveRoutine: (r) =>
        setState((s) => {
          const exists = s.routines.some((x) => x.id === r.id);
          return { routines: exists ? s.routines.map((x) => (x.id === r.id ? r : x)) : [...s.routines, r] };
        }),

      deleteRoutine: (id) =>
        setState((s) => {
          const schedule = { ...s.schedule };
          for (const k of Object.keys(schedule)) if (schedule[+k] === id) delete schedule[+k];
          return { routines: s.routines.filter((r) => r.id !== id), schedule };
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
        const routines: Routine[] = p.days.map((d) => ({
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
          const custom = { ...e, custom: true };
          return {
            customExercises: exists ? s.customExercises.map((x) => (x.id === e.id ? custom : x)) : [...s.customExercises, custom],
          };
        }),

      deleteExercise: (id) => setState((s) => ({ customExercises: s.customExercises.filter((e) => e.id !== id) })),

      addMeasurement: (m) =>
        setState((s) => ({ measurements: [...s.measurements, { ...m, id: uid() }].sort((a, b) => a.date - b.date) })),

      deleteMeasurement: (id) => setState((s) => ({ measurements: s.measurements.filter((m) => m.id !== id) })),

      updateSettings: (patch) => setState((s) => ({ settings: { ...s.settings, ...patch } })),

      setSchedule: (day, routineId) => setState((s) => ({ schedule: { ...s.schedule, [day]: routineId } })),

      setExerciseNote: (exerciseId, note) =>
        setState((s) => {
          const notes = { ...(s.exerciseNotes ?? {}) };
          if (note.trim()) notes[exerciseId] = note;
          else delete notes[exerciseId];
          return { exerciseNotes: notes };
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

      importBackup: (data, mode) =>
        setState((s) => {
          if (mode === 'replace') {
            return {
              ...initialData(),
              ...data,
              settings: { ...defaultSettings(), ...(data.settings ?? {}) },
            };
          }
          const byId = <T extends { id: string }>(a: T[], b: T[] = []) => {
            const map = new Map(a.map((x) => [x.id, x]));
            for (const x of b) map.set(x.id, x);
            return [...map.values()];
          };
          return {
            workouts: byId(s.workouts, data.workouts).sort((a, b) => b.startedAt - a.startedAt),
            routines: byId(s.routines, data.routines),
            customExercises: byId(s.customExercises, data.customExercises),
            measurements: byId(s.measurements, data.measurements).sort((a, b) => a.date - b.date),
            exerciseNotes: { ...(s.exerciseNotes ?? {}), ...(data.exerciseNotes ?? {}) },
          };
        }),

      importWorkouts: (workouts, exercises) => {
        const s = getState();
        const existing = new Set(s.workouts.map((w) => w.startedAt));
        const fresh = workouts.filter((w) => !existing.has(w.startedAt));
        const knownEx = new Set(s.customExercises.map((e) => e.id));
        setState({
          workouts: [...s.workouts, ...fresh].sort((a, b) => b.startedAt - a.startedAt),
          customExercises: [...s.customExercises, ...exercises.filter((e) => !knownEx.has(e.id))],
        });
        return fresh.length;
      },

      resetAll: () => setState({ ...initialData(), active: null, rest: null }),
    }),
    {
      // Storage key kept from the original working name so existing data is not lost.
      name: 'silak-data',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        workouts: s.workouts,
        routines: s.routines,
        customExercises: s.customExercises,
        measurements: s.measurements,
        settings: s.settings,
        schedule: s.schedule,
        exerciseNotes: s.exerciseNotes,
        active: s.active,
        rest: s.rest,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const settings = { ...defaultSettings(), ...(p.settings ?? {}) };
        // Existing users who already have history skip onboarding.
        if (!p.settings?.onboarded && (p.workouts?.length ?? 0) > 0) settings.onboarded = true;
        return { ...current, ...p, settings };
      },
      onRehydrateStorage: () => () => {
        useStore.setState({ hydrated: true });
      },
    },
  ),
);

/** Built-in plus custom exercises. */
export function useAllExercises(): Exercise[] {
  const custom = useStore((s) => s.customExercises);
  return useMemoExercises(custom);
}

let cacheKey: Exercise[] | null = null;
let cacheVal: Exercise[] = BUILTIN_EXERCISES;
function useMemoExercises(custom: Exercise[]): Exercise[] {
  if (cacheKey !== custom) {
    cacheKey = custom;
    cacheVal = [...BUILTIN_EXERCISES, ...custom].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
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
  };
}
