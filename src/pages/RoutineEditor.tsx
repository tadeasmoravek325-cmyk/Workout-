import { useState } from 'react';
import { Link2, Trash2, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Routine, RoutineExercise, SetType } from '../types';
import { useExerciseMap, useStore } from '../store/store';
import { uid } from '../lib/calc';
import { fmtClock, fmtNum, fromDisplayWeight, parseClock, toDisplayWeight } from '../lib/format';
import { ExercisePicker } from '../components/ExercisePicker';
import { NumInput, toast } from '../components/ui';

const TYPES: SetType[] = ['normal', 'warmup', 'drop', 'failure'];
const LABEL: Record<SetType, string> = { normal: '', warmup: 'W', drop: 'D', failure: 'F' };

export default function RoutineEditor() {
  const { id = 'new' } = useParams();
  const existing = useStore((s) => s.routines.find((r) => r.id === id));
  const routines = useStore((s) => s.routines);
  const saveRoutine = useStore((s) => s.saveRoutine);
  const settings = useStore((s) => s.settings);
  const exMap = useExerciseMap();
  const navigate = useNavigate();
  const [picker, setPicker] = useState(false);
  const [draft, setDraft] = useState<Routine>(
    () =>
      (existing && structuredClone(existing)) ?? {
        id: uid(),
        name: '',
        folder: '',
        notes: '',
        exercises: [],
        createdAt: Date.now(),
      },
  );
  const unit = settings.unit;
  const folders = [...new Set(routines.map((r) => r.folder).filter(Boolean))] as string[];

  const edit = (fn: (r: Routine) => void) =>
    setDraft((d) => {
      const c = structuredClone(d);
      fn(c);
      return c;
    });
  const editEx = (exId: string, fn: (e: RoutineExercise) => void) =>
    edit((r) => {
      const e = r.exercises.find((x) => x.id === exId);
      if (e) fn(e);
    });

  const save = () => {
    if (!draft.name.trim()) return toast('Pojmenuj rutinu');
    if (!draft.exercises.length) return toast('Přidej alespoň jeden cvik');
    saveRoutine({ ...draft, name: draft.name.trim(), folder: draft.folder?.trim() || undefined });
    toast('Rutina uložena');
    navigate('/train', { replace: true });
  };

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          Zrušit
        </button>
        <h2>{existing ? 'Upravit rutinu' : 'Nová rutina'}</h2>
        <button className="btn primary sm" onClick={save}>
          Uložit
        </button>
      </div>

      <div className="stack">
        <input
          className="wk-title"
          placeholder="Název rutiny"
          value={draft.name}
          onChange={(e) => {
            const v = e.target.value;
            edit((r) => void (r.name = v));
          }}
          autoFocus={!existing}
        />
        <div className="field">
          <label>Složka (nepovinné)</label>
          <input
            list="folders"
            value={draft.folder ?? ''}
            placeholder="např. Push/Pull/Legs"
            onChange={(e) => {
              const v = e.target.value;
              edit((r) => void (r.folder = v));
            }}
          />
          <datalist id="folders">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label>Poznámka</label>
          <textarea
            value={draft.notes ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              edit((r) => void (r.notes = v));
            }}
          />
        </div>
      </div>

      {draft.exercises.map((re, idx) => {
        const ex = exMap.get(re.exerciseId);
        if (!ex) return null;
        const showW = ex.type === 'weight_reps' || ex.type === 'weighted_bodyweight' || ex.type === 'assisted_bodyweight';
        const showR = ex.type !== 'duration' && ex.type !== 'distance_duration';
        const showT = !showR;
        let n = 0;
        return (
          <div key={re.id} className={`ex-card ${re.supersetId ? 'superset' : ''}`}>
            <div className="row between">
              <span className="ex-name grow ellipsis">{ex.name}</span>
              <button
                className="icon-btn"
                disabled={idx === 0}
                onClick={() => edit((r) => void ([r.exercises[idx - 1], r.exercises[idx]] = [r.exercises[idx], r.exercises[idx - 1]]))}
              >
                ↑
              </button>
              <button
                className="icon-btn"
                onClick={() => edit((r) => void (r.exercises = r.exercises.filter((x) => x.id !== re.id)))}
                aria-label="Odebrat"
              >
                <Trash2 size={17} />
              </button>
            </div>
            <div className="row small" style={{ gap: 8, marginTop: 8 }}>
              <span className="muted">Pauza</span>
              <select
                style={{ width: 'auto', padding: '5px 8px' }}
                value={re.restSec ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  editEx(re.id, (x) => void (x.restSec = v === '' ? undefined : Number(v)));
                }}
              >
                <option value="">Výchozí ({fmtClock(settings.defaultRestSec)})</option>
                {[0, 30, 45, 60, 90, 120, 150, 180, 240, 300].map((s) => (
                  <option key={s} value={s}>
                    {s === 0 ? 'Vypnuto' : fmtClock(s)}
                  </option>
                ))}
              </select>
              {idx < draft.exercises.length - 1 && (
                <button
                  className={`chip ${re.supersetId && re.supersetId === draft.exercises[idx + 1].supersetId ? 'on' : ''}`}
                  onClick={() =>
                    edit((r) => {
                      const a = r.exercises[idx];
                      const b = r.exercises[idx + 1];
                      if (a.supersetId && a.supersetId === b.supersetId) {
                        delete b.supersetId;
                        if (!r.exercises.some((x, i) => i !== idx && x.supersetId === a.supersetId)) delete a.supersetId;
                      } else {
                        const sid = a.supersetId ?? b.supersetId ?? uid();
                        a.supersetId = sid;
                        b.supersetId = sid;
                      }
                    })
                  }
                >
                  <Link2 size={14} /> Supersérie s dalším
                </button>
              )}
            </div>
            <table className="set-table">
              <thead>
                <tr>
                  <th style={{ width: 34 }}>Série</th>
                  {showW && <th>{unit}</th>}
                  {showR && <th>Opak.</th>}
                  {showT && <th>Čas</th>}
                  <th style={{ width: 22 }} />
                </tr>
              </thead>
              <tbody>
                {re.sets.map((s, i) => {
                  if (s.type === 'normal') n++;
                  return (
                    <tr key={i}>
                      <td>
                        <button
                          className={`set-type ${s.type}`}
                          onClick={() => editEx(re.id, (x) => void (x.sets[i].type = TYPES[(TYPES.indexOf(s.type) + 1) % TYPES.length]))}
                        >
                          {LABEL[s.type] || n}
                        </button>
                      </td>
                      {showW && (
                        <td>
                          <NumInput
                            value={toDisplayWeight(s.weight, unit)}
                            placeholder="–"
                            onChange={(v) => editEx(re.id, (x) => void (x.sets[i].weight = fromDisplayWeight(v, unit)))}
                          />
                        </td>
                      )}
                      {showR && (
                        <td>
                          <NumInput
                            value={s.reps}
                            placeholder="–"
                            onChange={(v) => editEx(re.id, (x) => void (x.sets[i].reps = v === undefined ? undefined : Math.round(v)))}
                          />
                        </td>
                      )}
                      {showT && (
                        <td>
                          <input
                            defaultValue={s.durationSec ? fmtClock(s.durationSec) : ''}
                            placeholder="0:45"
                            inputMode="numeric"
                            onBlur={(e) => {
                              const v = parseClock(e.target.value);
                              editEx(re.id, (x) => void (x.sets[i].durationSec = v));
                            }}
                          />
                        </td>
                      )}
                      <td>
                        <button className="del-set" onClick={() => editEx(re.id, (x) => void x.sets.splice(i, 1))}>
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
              onClick={() => editEx(re.id, (x) => void x.sets.push({ ...(x.sets[x.sets.length - 1] ?? { type: 'normal' }) }))}
            >
              + Přidat sérii
            </button>
            {re.sets.some((s) => s.weight) && (
              <div className="tiny muted mt">
                Celkem {fmtNum(toDisplayWeight(re.sets.reduce((a, s) => a + (s.weight ?? 0) * (s.reps ?? 0), 0), unit), 0)} {unit} objemu
              </div>
            )}
          </div>
        );
      })}

      <button className="btn soft block mt-l" onClick={() => setPicker(true)}>
        + Přidat cvik
      </button>

      {picker && (
        <ExercisePicker
          onClose={() => setPicker(false)}
          onPick={(ids) =>
            edit((r) => {
              for (const exerciseId of ids) {
                const ex = exMap.get(exerciseId);
                const timed = ex?.type === 'duration' || ex?.type === 'distance_duration';
                r.exercises.push({
                  id: uid(),
                  exerciseId,
                  sets: Array.from({ length: timed ? 1 : 3 }, () => ({ type: 'normal' as const, reps: timed ? undefined : 10 })),
                });
              }
            })
          }
        />
      )}
    </div>
  );
}
