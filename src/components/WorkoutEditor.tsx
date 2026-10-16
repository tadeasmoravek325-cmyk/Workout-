import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Calculator, Crosshair, Dumbbell, Flame, Link2, NotebookPen, Pin, Replace, Timer, Trash2, TrendingUp, TriangleAlert, Trophy, Unlink, X } from 'lucide-react';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Exercise, SetType, Settings, Workout, WorkoutExercise, WorkoutSet } from '../types';
import { newSet, newWorkoutExercise, useAllExercises, useExerciseMap, useStore } from '../store/store';
import {
  computeRecords,
  e1rm,
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
import { unlockAudio } from '../lib/feedback';
import { haptic, smallConfetti } from '../lib/celebrate';
import { plateCalc } from '../lib/calc';
import { PlateVisual } from './PlateVisual';
import { ExerciseAvatar, ExercisePicker } from './ExercisePicker';
import { NumInput, Sheet, toast, undoToast } from './ui';
import { BODY_PART_COLORS, BODY_PART_LABELS, EQUIPMENT_LABELS } from '../data/exercises';

type Mutate = (fn: (w: Workout) => void) => void;

const SET_TYPES: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
const SET_TYPE_LABEL: Record<SetType, string> = { normal: '', warmup: 'W', drop: 'D', failure: 'F' };
const SET_TYPE_NAME: Record<SetType, string> = {
  normal: 'Běžná série',
  warmup: 'Rozcvičovací',
  drop: 'Drop série',
  failure: 'Do selhání',
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
      return w ? `+${fmtNum(w)} ${unit} × ${s.reps ?? 0}` : `${s.reps ?? 0} opak.`;
    case 'assisted_bodyweight':
      return `−${fmtNum(w ?? 0)} ${unit} × ${s.reps ?? 0}`;
    case 'reps_only':
      return `${s.reps ?? 0} opak.`;
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
          <div style={{ marginTop: 8 }}>Přidej první cvik.</div>
        </div>
      )}
      {workout.exercises.map((we, i) => {
        const ex = exMap.get(we.exerciseId);
        if (!ex) return null;
        return (
          <ExerciseCard
            key={we.id}
            we={we}
            ex={ex}
            index={i}
            workout={workout}
            history={history}
            mutate={mutate}
            live={live}
            settings={settings}
          />
        );
      })}

      <button className="btn soft block mt-l" onClick={() => setPicker(true)}>
        + Přidat cvik
      </button>

      <div className="field mt-l">
        <label>Poznámka k tréninku</label>
        <textarea
          value={workout.notes ?? ''}
          placeholder="Jak ses cítil, spánek, energie…"
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
}: {
  we: WorkoutExercise;
  ex: Exercise;
  index: number;
  workout: Workout;
  history: Workout[];
  mutate: Mutate;
  live: boolean;
  settings: Settings;
}) {
  const startRest = useStore((s) => s.startRest);
  const allEx = useAllExercises();
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<null | 'rest' | 'substitute' | 'warmup' | 'pin' | 'plates'>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  const pinned = useStore((s) => s.exerciseNotes?.[ex.id]);
  const setExerciseNote = useStore((s) => s.setExerciseNote);
  const [pinDraft, setPinDraft] = useState('');

  const sessions: Session[] = useMemo(() => exerciseHistory(history, ex.id), [history, ex.id]);
  const prev = sessions[0];
  const records = useMemo(() => computeRecords(sessions), [sessions]);
  const suggestion: Suggestion | null = useMemo(
    () => (live && settings.smartCoach ? suggestNext(ex, sessions) : null),
    [live, settings.smartCoach, ex, sessions],
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
    if (hasReps(ex) && !filled.reps) return toast('Zadej počet opakování');
    if (hasTime(ex) && !filled.durationSec) return toast('Zadej čas');
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
      const celebrate = () => {
        smallConfetti();
        haptic([30, 60, 30]);
      };
      if (w > bestW && w > 0) {
        toast(`Nový rekord · ${ex.name}: ${fmtNum(toDisplayWeight(w, unit))} ${unit}`, 'pr', 4000);
        celebrate();
      } else if (one > best1 + 0.01) {
        toast(`Nové maximum (odhad 1RM) · ${ex.name}: ${fmtNum(toDisplayWeight(one, unit))} ${unit}`, 'pr', 4000);
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
    hasReps(ex) && 'Opak.',
    hasTime(ex) && 'Čas',
    hasReps(ex) && settings.showRpe && 'RPE',
  ].filter(Boolean) as string[];

  let normalNo = 0;
  const allDone = we.sets.length > 0 && we.sets.every((s) => s.done);

  return (
    <div className={`ex-card ${we.supersetId ? 'superset' : ''} ${allDone ? 'complete' : ''}`}>
      <div className="row between">
        <span className="bp-dot" style={{ background: BODY_PART_COLORS[ex.bodyPart] }} />
        <Link to={`/exercises/${ex.id}`} className="ex-name grow ellipsis">
          {ex.name}
        </Link>
        {allDone && <span className="badge ok">Hotovo</span>}
        {we.supersetId && <span className="badge" style={{ color: 'var(--purple)' }}>Supersérie</span>}
        <button className="icon-btn" onClick={() => setMenu(!menu)} aria-label="Možnosti cviku">
          ⋯
        </button>
      </div>
      <div className="row small muted" style={{ gap: 12, marginTop: 2 }}>
        {live && (
          <button className="small muted" onClick={() => setSheet('rest')}>
            <Timer size={13} style={{ verticalAlign: '-2px' }} /> {we.restSec === 0 ? 'Pauza vyp.' : fmtClock(we.restSec ?? settings.defaultRestSec)}
          </button>
        )}
        {records.maxE1rm > 0 && <span>1RM ≈ {fmtNum(toDisplayWeight(records.maxE1rm, unit))} {unit}</span>}
      </div>

      {menu && (
        <div className="menu" onClick={() => setMenu(false)}>
          <button onClick={() => upd((x) => void (x.notes = x.notes ?? ''))}>
            <NotebookPen size={17} /> Poznámka k dnešku
          </button>
          <button
            onClick={() => {
              setPinDraft(pinned ?? '');
              setSheet('pin');
            }}
          >
            <Pin size={17} /> Připnutá poznámka
          </button>
          {ex.equipment === 'barbell' && <button onClick={() => setSheet('plates')}>
              <Calculator size={17} /> Rozložení kotoučů
            </button>}
          {hasWeight(ex) && ex.type === 'weight_reps' && <button onClick={() => setSheet('warmup')}>
              <Flame size={17} /> Rozcvičovací série
            </button>}
          <button onClick={() => setSheet('rest')}>
            <Timer size={17} /> Nastavit pauzu
          </button>
          <button onClick={() => setSheet('substitute')}>
            <Replace size={17} /> Nahradit cvik
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
              <Link2 size={17} /> Supersérie s dalším cvikem
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
              <Unlink size={17} /> Zrušit supersérii
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
              <ArrowUp size={17} /> Posunout nahoru
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
              <ArrowDown size={17} /> Posunout dolů
            </button>
          )}
          <button
            className="danger"
            onClick={() => {
              const copy = structuredClone(we);
              mutate((w) => {
                w.exercises = w.exercises.filter((x) => x.id !== we.id);
              });
              undoToast(`${ex.name} odebrán`, () =>
                mutate((w) => {
                  if (!w.exercises.some((x) => x.id === copy.id)) w.exercises.splice(Math.min(index, w.exercises.length), 0, copy);
                }),
              );
            }}
          >
            <Trash2 size={17} /> Odebrat cvik
          </button>
        </div>
      )}

      {we.notes !== undefined && (
        <textarea
          className="mt"
          style={{ minHeight: 44 }}
          placeholder="Poznámka ke cviku (nastavení sedačky, úchop…)"
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
              Dnes:{' '}
              {describeSet(
                { weight: suggestion.weight, reps: suggestion.reps, durationSec: suggestion.durationSec },
                ex,
                settings,
              )}
            </div>
            <div className="muted tiny">{suggestion.reason}</div>
          </div>
          <button className="btn sm soft" onClick={applySuggestion}>
            Použít
          </button>
        </div>
      )}

      <table className="set-table">
        <thead>
          <tr>
            <th style={{ width: 34 }}>Série</th>
            <th>Předchozí</th>
            {cols.map((c) => (
              <th key={c} style={{ width: c === 'RPE' ? 48 : undefined }}>
                {c}
              </th>
            ))}
            <th style={{ width: 36 }}>✓</th>
            <th style={{ width: 22 }} />
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
                Object.assign(x.sets[i], patch);
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
              <tr key={s.id} className={`${s.done ? 'done' : ''} ${justDone === s.id ? 'just-done' : ''}`}>
                <td>
                  <button
                    className={`set-type ${s.type}`}
                    title={SET_TYPE_NAME[s.type]}
                    onClick={() => setField({ type: SET_TYPES[(SET_TYPES.indexOf(s.type) + 1) % SET_TYPES.length] })}
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
                      ariaLabel="Váha"
                      value={toDisplayWeight(s.weight, unit)}
                      placeholder={ph.weight !== undefined ? fmtNum(toDisplayWeight(ph.weight, unit)) : ''}
                      onChange={(v) => setField({ weight: fromDisplayWeight(v, unit) })}
                    />
                  </td>
                )}
                {ex.type === 'distance_duration' && (
                  <td>
                    <NumInput
                      ariaLabel="Vzdálenost"
                      value={s.distance}
                      placeholder={ph.distance !== undefined ? fmtNum(ph.distance, 2) : ''}
                      onChange={(v) => setField({ distance: v })}
                    />
                  </td>
                )}
                {hasReps(ex) && (
                  <td>
                    <NumInput
                      ariaLabel="Opakování"
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
                          {String(r).replace('.', ',')}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td>
                  <button className={`check ${s.done ? 'on' : ''}`} onClick={() => completeSet(s.id)} aria-label="Hotovo">
                    <Check size={18} strokeWidth={3.5} />
                  </button>
                </td>
                <td>
                  <button
                    className="del-set"
                    aria-label="Smazat sérii"
                    onClick={() => {
                      const copy = structuredClone(s);
                      upd((x) => {
                        x.sets.splice(i, 1);
                      });
                      if (copy.done || copy.weight !== undefined || copy.reps !== undefined)
                        undoToast('Série smazána', () =>
                          upd((x) => {
                            if (!x.sets.some((y) => y.id === copy.id)) x.sets.splice(Math.min(i, x.sets.length), 0, copy);
                          }),
                        );
                    }}
                  >
                    <X size={15} />
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
        + Přidat sérii
      </button>

      {sheet === 'rest' && (
        <Sheet title="Pauza po sérii" onClose={() => setSheet(null)}>
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
                {sec === 0 ? 'Vypnuto' : fmtClock(sec)}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet === 'pin' && (
        <Sheet
          title="Připnutá poznámka"
          onClose={() => setSheet(null)}
          action={
            <button
              className="btn ghost"
              onClick={() => {
                setExerciseNote(ex.id, pinDraft);
                setSheet(null);
              }}
            >
              Uložit
            </button>
          }
        >
          <p className="small muted" style={{ marginTop: 0 }}>
            Zobrazí se pokaždé, když budeš dělat {ex.name}. Ideální na nastavení stroje, úchop nebo technické body.
          </p>
          <textarea autoFocus value={pinDraft} onChange={(e) => setPinDraft(e.target.value)} placeholder="např. Sedačka na 4, úchop na šířku ramen" />
          <div className="grid-2 mt">
            <button
              className="btn danger"
              onClick={() => {
                setExerciseNote(ex.id, '');
                setSheet(null);
              }}
            >
              Odepnout
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setExerciseNote(ex.id, pinDraft);
                setSheet(null);
              }}
            >
              Uložit
            </button>
          </div>
        </Sheet>
      )}

      {sheet === 'plates' && (
        <Sheet title="Rozložení kotoučů" onClose={() => setSheet(null)}>
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
                <div className="small muted">Na každou stranu</div>
                <div className="bold" style={{ fontSize: 18 }}>
                  {per.length ? per.map((p) => fmtNum(p, 2)).join(' + ') : 'Jen osa'}
                </div>
                {res.remainder > 0.01 && (
                  <div className="small" style={{ color: 'var(--warn)', marginTop: 6 }}>
                    Nejbližší možná: {fmtNum(toDisplayWeight(res.achieved, unit))} {unit}
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
        <Sheet title={`Náhrada za: ${ex.name}`} onClose={() => setSheet(null)}>
          <p className="small muted" style={{ marginTop: 0 }}>
            Stroj obsazený? Tyhle cviky zapojují stejné svaly.
          </p>
          <div className="list">
            {findSubstitutes(ex, allEx).map((alt) => (
              <button
                key={alt.id}
                className="list-item"
                onClick={() => {
                  upd((x) => {
                    x.exerciseId = alt.id;
                    for (const s of x.sets) if (!s.done) delete s.weight;
                  });
                  setSheet(null);
                  toast(`Nahrazeno: ${alt.name}`);
                }}
              >
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
    <Sheet title="Rozcvičovací série" onClose={onClose}>
      <div className="field">
        <label>Pracovní váha ({unit})</label>
        <NumInput value={target} onChange={setTarget} placeholder="např. 100" />
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
        {!sets.length && <div className="empty">Zadej pracovní váhu vyšší než osa ({fmtNum(toDisplayWeight(settings.barWeightKg, unit))} {unit}).</div>}
      </div>
      <button className="btn primary block mt" disabled={!sets.length} onClick={() => onAdd(sets)}>
        Přidat rozcvičku
      </button>
    </Sheet>
  );
}
