import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Calculator, Copy, Crosshair, Dumbbell, Flame, Link2, ListPlus, NotebookPen, Pin, PlayCircle, Replace, Timer, Trash2, TrendingUp, TriangleAlert, Trophy, Unlink } from 'lucide-react';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Exercise, SetType, Settings, Workout, WorkoutExercise, WorkoutSet } from '../types';
import { newSet, newWorkoutExercise, useAllExercises, useExerciseMap, useStore } from '../store/store';
import {
  computeRecords,
  e1rm,
  targetSets,
  exerciseHistory,
  isWorkingSet,
  suggestNext,
  uid,
  warmupSets,
  type Session,
  type Suggestion,
} from '../lib/calc';
import { fmtClock, fmtNum, fromDisplayWeight, parseClock, toDisplayWeight } from '../lib/format';
import { findSubstitutes } from '../lib/substitutes';
import { askNotificationsOnce, unlockAudio } from '../lib/feedback';
import { haptic } from '../lib/celebrate';
import { plateCalc } from '../lib/calc';
import { PlateVisual } from './PlateVisual';
import { ExerciseAvatar, ExercisePicker } from './ExercisePicker';
import { NumInput, Sheet, toast, undoToast } from './ui';
import { BODY_PART_COLORS, BODY_PART_LABELS, EQUIPMENT_LABELS, youtubeSearchUrl } from '../data/exercises';
import { t, tn } from '../i18n';

type Mutate = (fn: (w: Workout) => void) => void;

const SET_TYPES: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
const SET_TYPE_LABEL: Record<SetType, string> = { normal: '', warmup: 'W', drop: 'D', failure: 'F' };
const SET_TYPE_NAME: Record<SetType, string> = {
  normal: 'Working set',
  warmup: 'Warm-up',
  drop: 'Drop set',
  failure: 'Failure',
};
const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];
const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

function hasWeight(ex: Exercise) {
  return ex.type === 'weight_reps' || ex.type === 'weighted_bodyweight' || ex.type === 'assisted_bodyweight';
}
function hasReps(ex: Exercise) {
  return ex.type !== 'duration' && ex.type !== 'distance_duration';
}
function hasTime(ex: Exercise) {
  return ex.type === 'duration' || ex.type === 'distance_duration';
}

export function describeSet(s: Partial<WorkoutSet>, ex: Exercise, settings: Settings): string {
  const unit = settings.unit;
  const w = toDisplayWeight(s.weight, unit);
  switch (ex.type) {
    case 'weight_reps':
      return `${fmtNum(w ?? 0)} ${unit} × ${s.reps ?? 0}`;
    case 'weighted_bodyweight':
      return w ? `+${fmtNum(w)} ${unit} × ${s.reps ?? 0}` : tn(s.reps ?? 0, '{n} rep', '{n} reps');
    case 'assisted_bodyweight':
      return `−${fmtNum(w ?? 0)} ${unit} × ${s.reps ?? 0}`;
    case 'reps_only':
      return tn(s.reps ?? 0, '{n} rep', '{n} reps');
    case 'duration':
      return fmtClock(s.durationSec ?? 0);
    case 'distance_duration':
      return `${fmtNum(s.distance ?? 0, 2)} km · ${fmtClock(s.durationSec ?? 0)}`;
  }
}

function TimeInput({ value, onChange, placeholder }: { value?: number; onChange: (v?: number) => void; placeholder?: string }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      inputMode="numeric"
      placeholder={placeholder}
      value={text ?? (value ? fmtClock(value) : '')}
      onFocus={(e) => {
        setText(value ? fmtClock(value) : '');
        e.target.select();
      }}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseClock(e.target.value));
      }}
      onBlur={() => setText(null)}
    />
  );
}

export function WorkoutEditor({
  workout,
  mutate,
  live,
}: {
  workout: Workout;
  mutate: Mutate;
  live: boolean;
}) {
  const exMap = useExerciseMap();
  const allWorkouts = useStore((s) => s.workouts);
  const settings = useStore((s) => s.settings);
  const [picker, setPicker] = useState(false);
  const [reorder, setReorder] = useState<{ id: string; y: number } | null>(null);

  // History without this workout and without anything later than it (when editing an old workout).
  const history = useMemo(
    () => allWorkouts.filter((w) => w.id !== workout.id && w.startedAt < workout.startedAt),
    [allWorkouts, workout.id, workout.startedAt],
  );

  const addExercises = (ids: string[]) =>
    mutate((w) => {
      for (const id of ids) {
        const prev = exerciseHistory(history, id)[0];
        const ex = exMap.get(id);
        const we = newWorkoutExercise(id, prev ? Math.max(1, prev.sets.filter(isWorkingSet).length) : 3);
        if (ex?.type === 'duration' || ex?.type === 'distance_duration') we.sets = we.sets.slice(0, prev ? we.sets.length : 1);
        w.exercises.push(we);
      }
    });

  return (
    <div>
      {workout.exercises.length === 0 && (
        <div className="empty">
          <Dumbbell size={36} className="muted" />
          <div style={{ marginTop: 8 }}>{t('Add your first exercise.')}</div>
        </div>
      )}
      {reorder && (
        <ReorderList
          workout={workout}
          exMap={exMap}
          startId={reorder.id}
          startY={reorder.y}
          onDone={(ids) => {
            setReorder(null);
            if (ids)
              mutate((w) => {
                const byId = new Map(w.exercises.map((x) => [x.id, x]));
                const next = ids.map((id) => byId.get(id)).filter((x): x is WorkoutExercise => !!x);
                if (next.length === w.exercises.length) w.exercises = next;
              });
          }}
        />
      )}
      {workout.exercises.map((we, i) => {
        const ex = exMap.get(we.exerciseId);
        if (!ex) return null;
        return (
          <div key={we.id} hidden={!!reorder}>
          <ExerciseCard
            we={we}
            ex={ex}
            index={i}
            workout={workout}
            history={history}
            mutate={mutate}
            live={live}
            settings={settings}
            onGrab={(y) => setReorder({ id: we.id, y })}
          />
          </div>
        );
      })}

      <button className="btn soft block mt-l" onClick={() => setPicker(true)}>
        + {t('Add exercise')}
      </button>

      <div className="field mt-l">
        <label>{t('Workout note')}</label>
        <textarea
          value={workout.notes ?? ''}
          placeholder={t('How did you feel? Sleep, energy…')}
          onChange={(e) => {
            const v = e.target.value;
            mutate((w) => {
              w.notes = v;
            });
          }}
        />
      </div>

      {picker && <ExercisePicker onClose={() => setPicker(false)} onPick={addExercises} />}
    </div>
  );
}

function ExerciseCard({
  we,
  ex,
  index,
  workout,
  history,
  mutate,
  live,
  settings,
  onGrab,
}: {
  we: WorkoutExercise;
  ex: Exercise;
  index: number;
  workout: Workout;
  history: Workout[];
  mutate: Mutate;
  live: boolean;
  settings: Settings;
  onGrab: (y: number) => void;
}) {
  const startRest = useStore((s) => s.startRest);
  const allEx = useAllExercises();
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<null | 'rest' | 'substitute' | 'warmup' | 'pin' | 'plates'>(null);
  const [swapAny, setSwapAny] = useState(false);
  const grab = useGrab(onGrab);
  const [justDone, setJustDone] = useState<string | null>(null);
  const [setIdx, setSetIdx] = useState<number | null>(null);
  const pinned = useStore((s) => s.exerciseNotes?.[ex.id]);
  const setExerciseNote = useStore((s) => s.setExerciseNote);
  const [pinDraft, setPinDraft] = useState('');

  const sessions: Session[] = useMemo(() => exerciseHistory(history, ex.id), [history, ex.id]);
  const prev = sessions[0];
  const records = useMemo(() => computeRecords(sessions), [sessions]);
  const exMap = useExerciseMap();
  // Hard sets already done on this exercise's muscles: in the last 3 days, and earlier in this workout.
  const recentSets = useMemo(
    () => targetSets(ex, history, exMap, workout.startedAt - 72 * 3_600_000),
    [ex, history, exMap, workout.startedAt],
  );
  const sessionSets = targetSets(ex, [workout], exMap, -Infinity, we.id);
  const suggestion: Suggestion | null = useMemo(
    () => (live && settings.smartCoach ? suggestNext(ex, sessions, { recent: recentSets, session: sessionSets }) : null),
    [live, settings.smartCoach, ex, sessions, recentSets, sessionSets],
  );

  const unit = settings.unit;
  const upd = (fn: (we: WorkoutExercise, w: Workout) => void) =>
    mutate((w) => {
      const target = w.exercises.find((x) => x.id === we.id);
      if (target) fn(target, w);
    });

  const supersetGroup = we.supersetId ? workout.exercises.filter((x) => x.supersetId === we.supersetId) : [];
  const isLastInSuperset = !we.supersetId || supersetGroup[supersetGroup.length - 1]?.id === we.id;

  const placeholderFor = (setIdx: number, s: WorkoutSet): Partial<WorkoutSet> => {
    const working = we.sets.slice(0, setIdx + 1).filter((x) => x.type === s.type).length - 1;
    const prevSame = prev?.sets.filter((x) => x.type === s.type)[working];
    if (suggestion && isWorkingSet(s) && s.type === 'normal') {
      return {
        weight: suggestion.weight ?? prevSame?.weight,
        reps: suggestion.reps ?? prevSame?.reps,
        durationSec: suggestion.durationSec ?? prevSame?.durationSec,
        distance: prevSame?.distance,
      };
    }
    return prevSame ?? {};
  };

  const completeSet = (setId: string) => {
    unlockAudio();
    if (live && settings.autoStartRest) askNotificationsOnce();
    const idx = we.sets.findIndex((s) => s.id === setId);
    const s = we.sets[idx];
    if (!s) return;
    if (s.done) {
      upd((x) => {
        x.sets[idx].done = false;
      });
      return;
    }
    const ph = placeholderFor(idx, s);
    const filled: WorkoutSet = {
      ...s,
      weight: s.weight ?? (hasWeight(ex) ? ph.weight : undefined),
      reps: s.reps ?? (hasReps(ex) ? ph.reps : undefined),
      durationSec: s.durationSec ?? (hasTime(ex) ? ph.durationSec : undefined),
      distance: s.distance ?? (ex.type === 'distance_duration' ? ph.distance : undefined),
      done: true,
    };
    if (hasReps(ex) && !filled.reps) return toast(t('Enter your reps'));
    if (hasTime(ex) && !filled.durationSec) return toast(t('Enter a time'));
    upd((x) => {
      x.sets[idx] = filled;
    });
    haptic(12);
    setJustDone(filled.id);
    setTimeout(() => setJustDone((j) => (j === filled.id ? null : j)), 700);
    if (!live) return;

    // Live PR check against history and sets already completed in this workout.
    if (sessions.length && isWorkingSet(filled) && (ex.type === 'weight_reps' || ex.type === 'weighted_bodyweight')) {
      const doneHere = workout.exercises
        .filter((x) => x.exerciseId === ex.id)
        .flatMap((x) => x.sets.filter((y) => y.done && y.id !== filled.id && isWorkingSet(y)));
      const bestW = Math.max(records.maxWeight, ...doneHere.map((y) => y.weight ?? 0));
      const best1 = Math.max(records.maxE1rm, ...doneHere.map((y) => e1rm(y.weight ?? 0, y.reps ?? 0)));
      const w = filled.weight ?? 0;
      const one = e1rm(w, filled.reps ?? 0);
      const celebrate = () => haptic([30, 60, 30]);
      if (w > bestW && w > 0) {
        toast(t('New PR · {exercise}: {weight} {unit}', { exercise: ex.name, weight: fmtNum(toDisplayWeight(w, unit)), unit }), 'pr', 4000);
        celebrate();
      } else if (one > best1 + 0.01) {
        toast(t('New best est. 1RM · {exercise}: {weight} {unit}', { exercise: ex.name, weight: fmtNum(toDisplayWeight(one, unit)), unit }), 'pr', 4000);
        celebrate();
      }
    }
    if (settings.autoStartRest && isLastInSuperset) startRest(we.restSec ?? settings.defaultRestSec);
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    upd((x) => {
      for (const s of x.sets) {
        if (s.done || s.type !== 'normal') continue;
        if (suggestion.weight !== undefined) s.weight = suggestion.weight;
        if (suggestion.reps !== undefined) s.reps = suggestion.reps;
        if (suggestion.durationSec !== undefined) s.durationSec = suggestion.durationSec;
      }
    });
  };

  const workingWeight =
    we.sets.find((s) => s.type === 'normal' && s.weight)?.weight ?? suggestion?.weight ?? prev?.sets.find(isWorkingSet)?.weight ?? 0;

  const cols = [
    hasWeight(ex) && (ex.type === 'assisted_bodyweight' ? `−${unit}` : ex.type === 'weighted_bodyweight' ? `+${unit}` : unit),
    ex.type === 'distance_duration' && 'km',
    hasReps(ex) && t('Reps'),
    hasTime(ex) && t('Time'),
    hasReps(ex) && settings.showRpe && 'RPE',
  ].filter(Boolean) as string[];

  const replaceWith = (alt: Exercise) => {
    upd((x) => {
      x.exerciseId = alt.id;
      for (const s of x.sets) if (!s.done) delete s.weight;
    });
    setSheet(null);
    setSwapAny(false);
    toast(t('Replaced with {exercise}', { exercise: alt.name }));
  };

  const deleteSet = (i: number) => {
    const copy = structuredClone(we.sets[i]);
    if (!copy) return;
    upd((x) => {
      x.sets.splice(i, 1);
    });
    undoToast(t('Set deleted'), () =>
      upd((x) => {
        if (!x.sets.some((y) => y.id === copy.id)) x.sets.splice(Math.min(i, x.sets.length), 0, copy);
      }),
    );
  };

  // Swipe a set row to the left to delete it.
  const swipeStart = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null);
  const SWIPE_DELETE = 90;
  const swipeHandlers = (id: string, i: number) => ({
    onTouchStart: (e: React.TouchEvent) => {
      const p = e.touches[0];
      swipeStart.current = { x: p.clientX, y: p.clientY, horizontal: null };
    },
    onTouchMove: (e: React.TouchEvent) => {
      const st = swipeStart.current;
      if (!st) return;
      const p = e.touches[0];
      const dx = p.clientX - st.x;
      const dy = p.clientY - st.y;
      if (st.horizontal === null && Math.hypot(dx, dy) > 10) st.horizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
      if (st.horizontal) setSwipe({ id, dx: Math.min(0, dx) });
    },
    onTouchEnd: () => {
      const st = swipeStart.current;
      swipeStart.current = null;
      const s = swipe;
      setSwipe(null);
      if (st?.horizontal && s && s.id === id && s.dx <= -SWIPE_DELETE) {
        haptic(15);
        deleteSet(i);
      }
    },
    onTouchCancel: () => {
      swipeStart.current = null;
      setSwipe(null);
    },
  });

  let normalNo = 0;
  const allDone = we.sets.length > 0 && we.sets.every((s) => s.done);

  return (
    <div className={`ex-card ${we.supersetId ? 'superset' : ''} ${allDone ? 'complete' : ''}`}>
      <div className="row between">
        <span className="bp-dot" style={{ background: BODY_PART_COLORS[ex.bodyPart] }} />
        <Link to={`/exercises/${ex.id}`} className="ex-name grow ellipsis grab" {...grab}>
          {ex.name}
        </Link>
        {allDone && <span className="badge ok">{t('Done')}</span>}
        {we.supersetId && <span className="badge" style={{ color: 'var(--purple)' }}>{t('Superset')}</span>}
        <button className="icon-btn" onClick={() => setMenu(!menu)} aria-label={t('Exercise options')}>
          ⋯
        </button>
      </div>
      <div className="row small muted" style={{ gap: 12, marginTop: 2 }}>
        {live && (
          <button className="small muted" onClick={() => setSheet('rest')}>
            <Timer size={13} style={{ verticalAlign: '-2px' }} /> {we.restSec === 0 ? t('Rest off') : fmtClock(we.restSec ?? settings.defaultRestSec)}
          </button>
        )}
        {records.maxE1rm > 0 && <span>1RM ≈ {fmtNum(toDisplayWeight(records.maxE1rm, unit))} {unit}</span>}
      </div>

      {menu && (
        <div className="menu" onClick={() => setMenu(false)}>
          <button onClick={() => upd((x) => void (x.notes = x.notes ?? ''))}>
            <NotebookPen size={17} /> {t("Note for today")}
          </button>
          <button
            onClick={() => {
              setPinDraft(pinned ?? '');
              setSheet('pin');
            }}
          >
            <Pin size={17} /> {t('Pinned note')}
          </button>
          {ex.equipment === 'barbell' && <button onClick={() => setSheet('plates')}>
              <Calculator size={17} /> {t('Plate calculator')}
            </button>}
          {hasWeight(ex) && ex.type === 'weight_reps' && <button onClick={() => setSheet('warmup')}>
              <Flame size={17} /> {t('Warm-up sets')}
            </button>}
          <button onClick={() => setSheet('rest')}>
            <Timer size={17} /> {t('Set rest time')}
          </button>
          <a href={youtubeSearchUrl(ex)} target="_blank" rel="noreferrer">
            <PlayCircle size={17} /> {t('How to do it (video)')}
          </a>
          <button onClick={() => setSheet('substitute')}>
            <Replace size={17} /> {t('Replace exercise')}
          </button>
          {index < workout.exercises.length - 1 && !we.supersetId && (
            <button
              onClick={() =>
                mutate((w) => {
                  const a = w.exercises[index];
                  const b = w.exercises[index + 1];
                  const id = b.supersetId ?? uid();
                  a.supersetId = id;
                  b.supersetId = id;
                })
              }
            >
              <Link2 size={17} /> {t('Superset with next exercise')}
            </button>
          )}
          {we.supersetId && (
            <button
              onClick={() =>
                mutate((w) => {
                  const id = we.supersetId;
                  for (const x of w.exercises) if (x.supersetId === id) delete x.supersetId;
                })
              }
            >
              <Unlink size={17} /> {t('Remove superset')}
            </button>
          )}
          {index > 0 && (
            <button
              onClick={() =>
                mutate((w) => {
                  [w.exercises[index - 1], w.exercises[index]] = [w.exercises[index], w.exercises[index - 1]];
                })
              }
            >
              <ArrowUp size={17} /> {t('Move up')}
            </button>
          )}
          {index < workout.exercises.length - 1 && (
            <button
              onClick={() =>
                mutate((w) => {
                  [w.exercises[index + 1], w.exercises[index]] = [w.exercises[index], w.exercises[index + 1]];
                })
              }
            >
              <ArrowDown size={17} /> {t('Move down')}
            </button>
          )}
          <button
            className="danger"
            onClick={() => {
              const copy = structuredClone(we);
              mutate((w) => {
                w.exercises = w.exercises.filter((x) => x.id !== we.id);
              });
              undoToast(t('{exercise} removed', { exercise: ex.name }), () =>
                mutate((w) => {
                  if (!w.exercises.some((x) => x.id === copy.id)) w.exercises.splice(Math.min(index, w.exercises.length), 0, copy);
                }),
              );
            }}
          >
            <Trash2 size={17} /> {t('Remove exercise')}
          </button>
        </div>
      )}

      {we.notes !== undefined && (
        <textarea
          className="mt"
          style={{ minHeight: 44 }}
          placeholder={t('Exercise note (seat setting, grip…)')}
          value={we.notes}
          onChange={(e) => {
            const v = e.target.value;
            upd((x) => {
              x.notes = v;
            });
          }}
        />
      )}

      {pinned && (
        <button
          className="sticky-note"
          style={{ width: 'calc(100% - 4px)', textAlign: 'left' }}
          onClick={() => {
            setPinDraft(pinned);
            setSheet('pin');
          }}
        >
          <Pin size={15} style={{ marginTop: 2 }} />
          <span className="grow">{pinned}</span>
        </button>
      )}

      {suggestion && (
        <div className={`coach ${suggestion.kind === 'deload' ? 'deload' : ''}`}>
          <span className="coach-ico">
            {suggestion.kind === 'deload' ? <TriangleAlert size={18} /> : suggestion.kind === 'increase' ? <TrendingUp size={18} /> : <Crosshair size={18} />}
          </span>
          <div className="grow">
            <div className="bold">
              {t('Today:')}{' '}
              {describeSet(
                { weight: suggestion.weight, reps: suggestion.reps, durationSec: suggestion.durationSec },
                ex,
                settings,
              )}
            </div>
            <div className="muted tiny">{suggestion.reason}</div>
          </div>
          <button className="btn sm soft" onClick={applySuggestion}>
            {t('Apply')}
          </button>
        </div>
      )}

      <table className="set-table">
        <thead>
          <tr>
            <th style={{ width: 34 }}>{t('Set')}</th>
            <th>{t('Previous')}</th>
            {cols.map((c) => (
              <th key={c} style={{ width: c === 'RPE' ? 48 : undefined }}>
                {c}
              </th>
            ))}
            <th style={{ width: 36 }}>✓</th>
          </tr>
        </thead>
        <tbody>
          {we.sets.map((s, i) => {
            if (s.type === 'normal') normalNo++;
            const ph = placeholderFor(i, s);
            const prevSame = (() => {
              const n = we.sets.slice(0, i + 1).filter((x) => x.type === s.type).length - 1;
              return prev?.sets.filter((x) => x.type === s.type)[n];
            })();
            const setField = (patch: Partial<WorkoutSet>) =>
              upd((x) => {
                const cur = x.sets[i];
                const before = { weight: cur.weight, reps: cur.reps };
                Object.assign(cur, patch);
                // Following sets that still match this one (empty, or equal to its old value) take the new value;
                // propagation stops at the first set the user has set differently.
                if (cur.type !== 'normal') return;
                const follow = (field: 'weight' | 'reps', emptyFollows: boolean) => {
                  if (!(field in patch)) return;
                  for (const next of x.sets.slice(i + 1)) {
                    if (next.done || next.type !== 'normal') continue;
                    const v = next[field];
                    const follows = v === undefined ? emptyFollows : v === before[field];
                    if (!follows) break;
                    next[field] = patch[field];
                  }
                };
                follow('weight', true);
                follow('reps', false);
              });
            const isPr =
              s.done &&
              isWorkingSet(s) &&
              sessions.length > 0 &&
              ex.type === 'weight_reps' &&
              (s.weight ?? 0) > records.maxWeight;
            const perf = (() => {
              if (!s.done || !prevSame || isPr) return 0;
              const score = (x: Partial<WorkoutSet>) =>
                hasWeight(ex) && ex.type !== 'assisted_bodyweight'
                  ? e1rm(x.weight ?? 0, x.reps ?? 0) || (x.reps ?? 0)
                  : ex.type === 'assisted_bodyweight'
                    ? (x.reps ?? 0) * 100 - (x.weight ?? 0)
                    : hasReps(ex)
                      ? (x.reps ?? 0)
                      : ex.type === 'distance_duration'
                        ? (x.distance ?? 0)
                        : (x.durationSec ?? 0);
              const a = score(s);
              const b = score(prevSame);
              return a > b + 1e-6 ? 1 : a < b - 1e-6 ? -1 : 0;
            })();
            return (
              <tr
                key={s.id}
                className={`${s.done ? 'done' : ''} ${justDone === s.id ? 'just-done' : ''} ${swipe?.id === s.id ? 'swiping' : ''} ${swipe?.id === s.id && swipe.dx <= -SWIPE_DELETE ? 'will-delete' : ''}`}
                style={swipe?.id === s.id ? { transform: `translateX(${swipe.dx}px)` } : undefined}
                {...swipeHandlers(s.id, i)}
              >
                <td>
                  <button
                    className={`set-type ${s.type}`}
                    aria-label={t('Set {n}: {type}. Options', { n: SET_TYPE_LABEL[s.type] || normalNo, type: t(SET_TYPE_NAME[s.type]) })}
                    onClick={() => setSetIdx(i)}
                  >
                    {SET_TYPE_LABEL[s.type] || normalNo}
                  </button>
                </td>
                <td>
                  <span
                    className="prev"
                    onClick={() => prevSame && !s.done && setField({ ...prevSame, id: s.id, type: s.type, done: false })}
                  >
                    {prevSame ? describeSet(prevSame, ex, settings) : '—'}
                    {isPr && (
                      <span className="perf up">
                        <Trophy size={11} />
                      </span>
                    )}
                    {perf === 1 && <span className="perf up">▲</span>}
                    {perf === -1 && <span className="perf down">▼</span>}
                  </span>
                </td>
                {hasWeight(ex) && (
                  <td>
                    <NumInput
                      ariaLabel={t('Weight')}
                      value={toDisplayWeight(s.weight, unit)}
                      placeholder={ph.weight !== undefined ? fmtNum(toDisplayWeight(ph.weight, unit)) : ''}
                      onChange={(v) => setField({ weight: fromDisplayWeight(v, unit) })}
                    />
                  </td>
                )}
                {ex.type === 'distance_duration' && (
                  <td>
                    <NumInput
                      ariaLabel={t('Distance')}
                      value={s.distance}
                      placeholder={ph.distance !== undefined ? fmtNum(ph.distance, 2) : ''}
                      onChange={(v) => setField({ distance: v })}
                    />
                  </td>
                )}
                {hasReps(ex) && (
                  <td>
                    <NumInput
                      ariaLabel={t('Reps')}
                      value={s.reps}
                      placeholder={ph.reps !== undefined ? String(ph.reps) : ''}
                      onChange={(v) => setField({ reps: v === undefined ? undefined : Math.round(v) })}
                    />
                  </td>
                )}
                {hasTime(ex) && (
                  <td>
                    <TimeInput
                      value={s.durationSec}
                      placeholder={ph.durationSec ? fmtClock(ph.durationSec) : '0:00'}
                      onChange={(v) => setField({ durationSec: v })}
                    />
                  </td>
                )}
                {hasReps(ex) && settings.showRpe && (
                  <td>
                    <select
                      className="rpe-select"
                      aria-label="RPE"
                      value={s.rpe ?? ''}
                      onChange={(e) => setField({ rpe: e.target.value ? Number(e.target.value) : undefined })}
                    >
                      <option value="">–</option>
                      {RPE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {fmtNum(r, 1)}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td>
                  <button className={`check ${s.done ? 'on' : ''}`} onClick={() => completeSet(s.id)} aria-label={t('Done')}>
                    <Check size={18} strokeWidth={3.5} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button
        className="btn sm block mt"
        onClick={() =>
          upd((x) => {
            x.sets.push(newSet(x.sets[x.sets.length - 1]));
          })
        }
      >
        + {t('Add set')}
      </button>

      {setIdx !== null && we.sets[setIdx] && (
        <Sheet title={t('Set {n}', { n: setIdx + 1 })} onClose={() => setSetIdx(null)}>
          <div className="small muted" style={{ marginBottom: 10 }}>
            {t('Set type')}
          </div>
          <div className="set-menu-types">
            {SET_TYPES.map((st) => (
              <button
                key={st}
                className={we.sets[setIdx].type === st ? 'on' : ''}
                onClick={() => {
                  upd((x) => {
                    x.sets[setIdx].type = st;
                  });
                  setSetIdx(null);
                }}
              >
                <span className="t">{SET_TYPE_LABEL[st] || '1'}</span>
                {t(SET_TYPE_NAME[st])}
              </button>
            ))}
          </div>
          <div className="stack mt-l">
            <button
              className="btn block"
              onClick={() => {
                const i = setIdx;
                upd((x) => {
                  const copy = { ...x.sets[i], id: uid(), done: false };
                  x.sets.splice(i + 1, 0, copy);
                });
                setSetIdx(null);
              }}
            >
              <Copy size={18} /> {t('Duplicate set')}
            </button>
            <button
              className="btn danger block"
              onClick={() => {
                deleteSet(setIdx);
                setSetIdx(null);
              }}
            >
              <Trash2 size={18} /> {t('Delete set')}
            </button>
          </div>
        </Sheet>
      )}

      {sheet === 'rest' && (
        <Sheet title={t('Rest after each set')} onClose={() => setSheet(null)}>
          <div className="grid-3">
            {REST_OPTIONS.map((sec) => (
              <button
                key={sec}
                className={`btn ${(we.restSec ?? settings.defaultRestSec) === sec ? 'primary' : ''}`}
                onClick={() => {
                  upd((x) => {
                    x.restSec = sec;
                  });
                  setSheet(null);
                }}
              >
                {sec === 0 ? t('Off') : fmtClock(sec)}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet === 'pin' && (
        <Sheet
          title={t('Pinned note')}
          onClose={() => setSheet(null)}
          action={
            <button
              className="btn ghost"
              onClick={() => {
                setExerciseNote(ex.id, pinDraft);
                setSheet(null);
              }}
            >
              {t('Save')}
            </button>
          }
        >
          <p className="small muted" style={{ marginTop: 0 }}>
            {t('Shows up every time you do {exercise}. Great for machine settings, grip or form cues.', { exercise: ex.name })}
          </p>
          <textarea autoFocus value={pinDraft} onChange={(e) => setPinDraft(e.target.value)} placeholder={t('e.g. Seat on 4, shoulder-width grip')} />
          <div className="grid-2 mt">
            <button
              className="btn danger"
              onClick={() => {
                setExerciseNote(ex.id, '');
                setSheet(null);
              }}
            >
              {t('Unpin')}
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setExerciseNote(ex.id, pinDraft);
                setSheet(null);
              }}
            >
              {t('Save')}
            </button>
          </div>
        </Sheet>
      )}

      {sheet === 'plates' && (
        <Sheet title={t('Plate calculator')} onClose={() => setSheet(null)}>
          {(() => {
            const target = we.sets.find((x) => !x.done && x.weight)?.weight ?? workingWeight;
            const res = plateCalc(target, settings.barWeightKg, settings.plates);
            const per = res.perSide.map((p) => Math.round((toDisplayWeight(p, unit) ?? 0) * 100) / 100);
            return (
              <div className="center">
                <div className="num-xl" style={{ fontSize: 36 }}>
                  {fmtNum(toDisplayWeight(target, unit))} {unit}
                </div>
                <PlateVisual plates={per} />
                <div className="small muted">{t('Per side')}</div>
                <div className="bold" style={{ fontSize: 18 }}>
                  {per.length ? per.map((p) => fmtNum(p, 2)).join(' + ') : t('Just the bar')}
                </div>
                {res.remainder > 0.01 && (
                  <div className="small" style={{ color: 'var(--warn)', marginTop: 6 }}>
                    {t('Closest possible: {weight} {unit}', { weight: fmtNum(toDisplayWeight(res.achieved, unit)), unit })}
                  </div>
                )}
              </div>
            );
          })()}
        </Sheet>
      )}

      {sheet === 'warmup' && (
        <WarmupSheet
          workingKg={workingWeight}
          settings={settings}
          onClose={() => setSheet(null)}
          onAdd={(sets) => {
            upd((x) => {
              x.sets = [
                ...sets.map((ws) => ({ id: uid(), type: 'warmup' as const, weight: ws.weight, reps: ws.reps, done: false })),
                ...x.sets.filter((y) => y.type !== 'warmup' || y.done),
              ];
            });
            setSheet(null);
          }}
        />
      )}

      {sheet === 'substitute' && (
        <Sheet title={t('Replace {exercise}', { exercise: ex.name })} onClose={() => setSheet(null)}>
          <p className="small muted" style={{ marginTop: 0 }}>
            {t('Machine taken? These exercises work the same muscles.')}
          </p>
          <button className="btn block" onClick={() => setSwapAny(true)}>
            <ListPlus size={18} /> {t('Choose any exercise')}
          </button>
          <div className="list mt">
            {findSubstitutes(ex, allEx).map((alt) => (
              <button key={alt.id} className="list-item" onClick={() => replaceWith(alt)}>
                <ExerciseAvatar ex={alt} />
                <div className="grow">
                  <div className="bold">{alt.name}</div>
                  <div className="small muted">
                    {BODY_PART_LABELS[alt.bodyPart]} · {EQUIPMENT_LABELS[alt.equipment]}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {swapAny && (
        <ExercisePicker
          multi={false}
          title={t('Replace {exercise}', { exercise: ex.name })}
          onClose={() => setSwapAny(false)}
          onPick={([id]) => {
            const alt = allEx.find((x) => x.id === id);
            if (alt) replaceWith(alt);
          }}
        />
      )}
    </div>
  );
}

function WarmupSheet({
  workingKg,
  settings,
  onClose,
  onAdd,
}: {
  workingKg: number;
  settings: Settings;
  onClose: () => void;
  onAdd: (sets: { weight: number; reps: number }[]) => void;
}) {
  const unit = settings.unit;
  const [target, setTarget] = useState<number | undefined>(toDisplayWeight(workingKg, unit) || undefined);
  const kg = fromDisplayWeight(target, unit) ?? 0;
  const sets = warmupSets(kg, settings.barWeightKg, unit === 'kg' ? 2.5 : 5 * 0.45359237);
  return (
    <Sheet title={t('Warm-up sets')} onClose={onClose}>
      <div className="field">
        <label>{t('Working weight ({unit})', { unit })}</label>
        <NumInput value={target} onChange={setTarget} placeholder={t('e.g. 100')} />
      </div>
      <div className="list mt">
        {sets.map((s, i) => (
          <div key={i} className="list-item">
            <span className="set-type warmup" style={{ display: 'grid', placeItems: 'center' }}>
              W
            </span>
            <div className="grow bold">
              {fmtNum(toDisplayWeight(s.weight, unit))} {unit} × {s.reps}
            </div>
            <span className="small muted">{Math.round((s.weight / kg) * 100)} %</span>
          </div>
        ))}
        {!sets.length && <div className="empty">
            {t('Enter a working weight heavier than the bar ({weight} {unit}).', { weight: fmtNum(toDisplayWeight(settings.barWeightKg, unit)), unit })}
          </div>}
      </div>
      <button className="btn primary block mt" disabled={!sets.length} onClick={() => onAdd(sets)}>
        {t('Add warm-up')}
      </button>
    </Sheet>
  );
}

const ROW_H = 56;
const HOLD_MS = 280;

/** Press and hold an exercise name to pick the card up; moving first means the user is scrolling. */
function useGrab(onGrab: (y: number) => void) {
  const st = useRef<{ timer?: number; x: number; y: number; grabbed: boolean }>({ x: 0, y: 0, grabbed: false });
  const clear = () => {
    window.clearTimeout(st.current.timer);
    st.current.timer = undefined;
  };
  useEffect(() => clear, []);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      clear();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* not supported */
      }
      const y = e.clientY;
      st.current.x = e.clientX;
      st.current.y = y;
      st.current.grabbed = false;
      st.current.timer = window.setTimeout(() => {
        st.current.grabbed = true;
        haptic(15);
        onGrab(y);
      }, HOLD_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (st.current.timer && Math.hypot(e.clientX - st.current.x, e.clientY - st.current.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onClick: (e: React.MouseEvent) => {
      if (st.current.grabbed) e.preventDefault();
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

/** Collapsed list of exercise names; the grabbed row follows the finger and the others slide out of the way. */
function ReorderList({
  workout,
  exMap,
  startId,
  startY,
  onDone,
}: {
  workout: Workout;
  exMap: Map<string, Exercise>;
  startId: string;
  startY: number;
  onDone: (ids: string[] | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const baseIds = useMemo(() => workout.exercises.map((x) => x.id), [workout.exercises]);
  const [pointerY, setPointerY] = useState(startY);
  const [top, setTop] = useState(0);
  const idsRef = useRef(baseIds);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useLayoutEffect(() => {
    box.current?.scrollIntoView({ block: 'center' });
    setTop(box.current?.getBoundingClientRect().top ?? 0);
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      setPointerY(e.clientY);
      setTop(box.current?.getBoundingClientRect().top ?? 0);
    };
    const end = (cancel: boolean) => () =>
      doneRef.current(cancel || idsRef.current.join() === baseIds.join() ? null : idsRef.current);
    const up = end(false);
    const cancel = end(true);
    const block = (e: TouchEvent) => e.preventDefault();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('touchmove', block, { passive: false });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('touchmove', block);
    };
  }, [baseIds]);

  const n = baseIds.length;
  const dragTop = Math.min(Math.max(pointerY - top - ROW_H / 2, 0), (n - 1) * ROW_H);
  const target = Math.min(n - 1, Math.max(0, Math.round(dragTop / ROW_H)));
  const order = baseIds.filter((id) => id !== startId);
  order.splice(target, 0, startId);
  idsRef.current = order;

  return (
    <div ref={box} className="reorder" style={{ height: n * ROW_H }}>
      {workout.exercises.map((we) => {
        const ex = exMap.get(we.exerciseId);
        const dragging = we.id === startId;
        return (
          <div
            key={we.id}
            className={`reorder-row ${dragging ? 'lifted' : ''}`}
            style={{ height: ROW_H - 8, transform: `translateY(${dragging ? dragTop : order.indexOf(we.id) * ROW_H}px)` }}
          >
            <span className="bp-dot" style={{ background: ex ? BODY_PART_COLORS[ex.bodyPart] : undefined }} />
            <span className="ex-name grow ellipsis">{ex?.name ?? ''}</span>
            <span className="muted small">{we.sets.length}×</span>
          </div>
        );
      })}
    </div>
  );
}
