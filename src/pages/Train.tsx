import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useExerciseMap, useStore } from '../store/store';
import { PROGRAMS, type Program } from '../data/programs';
import { Sheet, toast } from '../components/ui';
import { exerciseHistory } from '../lib/calc';
import { plural, relativeDay } from '../lib/format';
import { uid } from '../lib/calc';
import type { Routine } from '../types';

export default function Train() {
  const routines = useStore((s) => s.routines);
  const workouts = useStore((s) => s.workouts);
  const active = useStore((s) => s.active);
  const startWorkout = useStore((s) => s.startWorkout);
  const saveRoutine = useStore((s) => s.saveRoutine);
  const deleteRoutine = useStore((s) => s.deleteRoutine);
  const importProgram = useStore((s) => s.importProgram);
  const exMap = useExerciseMap();
  const navigate = useNavigate();
  const [program, setProgram] = useState<Program | null>(null);
  const [preview, setPreview] = useState<Routine | null>(null);

  const start = (r?: Routine) => {
    if (active) {
      toast('Už máš rozběhnutý trénink');
      navigate('/workout');
      return;
    }
    startWorkout(r);
    navigate('/workout');
  };

  const folders = new Map<string, Routine[]>();
  for (const r of routines) {
    const f = r.folder || 'Moje rutiny';
    folders.set(f, [...(folders.get(f) ?? []), r]);
  }

  const lastDone = (r: Routine) => workouts.find((w) => w.routineId === r.id)?.startedAt;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Trénink</h1>
      </div>

      <button className="btn primary block" onClick={() => start()}>
        {active ? '▶ Pokračovat v tréninku' : '+ Začít prázdný trénink'}
      </button>

      <div className="section">
        <div className="section-title">
          <h2>Rutiny</h2>
          <Link to="/routines/new">+ Nová rutina</Link>
        </div>
        {!routines.length && (
          <div className="card empty">
            <div className="big">📋</div>
            Zatím nemáš žádnou rutinu. Vytvoř si vlastní, nebo importuj hotový program níže.
          </div>
        )}
        {[...folders.entries()].map(([folder, list]) => (
          <div key={folder} style={{ marginBottom: 14 }}>
            <div className="small muted bold" style={{ margin: '6px 2px' }}>
              📁 {folder}
            </div>
            <div className="grid-2">
              {list.map((r) => {
                const last = lastDone(r);
                return (
                  <button key={r.id} className="card tap" style={{ textAlign: 'left' }} onClick={() => setPreview(r)}>
                    <h3 className="ellipsis">{r.name}</h3>
                    <div className="small muted" style={{ marginTop: 4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {r.exercises.map((e) => exMap.get(e.exerciseId)?.name).join(', ')}
                    </div>
                    <div className="tiny muted" style={{ marginTop: 6 }}>
                      {last ? `Naposledy: ${relativeDay(last)}` : 'Ještě neodcvičeno'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-title">
          <h2>Hotové programy</h2>
        </div>
        <div className="stack">
          {PROGRAMS.map((p) => (
            <button key={p.id} className="card tap" style={{ textAlign: 'left' }} onClick={() => setProgram(p)}>
              <div className="row between">
                <h3>{p.name}</h3>
                <span className="badge accent">{p.daysPerWeek}× týdně</span>
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>
                {p.level} · {p.goal}
              </div>
            </button>
          ))}
        </div>
      </div>

      {program && (
        <Sheet title={program.name} onClose={() => setProgram(null)}>
          <p className="muted" style={{ marginTop: 0 }}>
            {program.description}
          </p>
          <div className="row" style={{ gap: 6 }}>
            <span className="badge">{program.level}</span>
            <span className="badge">{program.goal}</span>
            <span className="badge">{program.daysPerWeek}× týdně</span>
          </div>
          {program.days.map((d) => (
            <div key={d.name} className="card mt">
              <h3>{d.name}</h3>
              {d.exercises.map((e, i) => (
                <div key={i} className="row between small" style={{ marginTop: 6 }}>
                  <span className="ellipsis">{exMap.get(e.exerciseId)?.name}</span>
                  <span className="muted">
                    {e.sets} × {e.durationSec ? `${e.durationSec} s` : e.reps || '—'}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <button
            className="btn primary block mt-l"
            onClick={() => {
              const n = importProgram(program.id);
              toast(`${plural(n, ['Přidána', 'Přidány', 'Přidáno'])} ${n} ${plural(n, ['rutina', 'rutiny', 'rutin'])} do složky „${program.name}“`);
              setProgram(null);
            }}
          >
            Přidat do mých rutin
          </button>
        </Sheet>
      )}

      {preview && (
        <Sheet title={preview.name} onClose={() => setPreview(null)}>
          {preview.notes && <p className="muted">{preview.notes}</p>}
          <div className="list">
            {preview.exercises.map((e) => {
              const last = exerciseHistory(workouts, e.exerciseId)[0];
              return (
                <div key={e.id} className="list-item">
                  <div className="grow">
                    <div className="bold">
                      {e.sets.length} × {exMap.get(e.exerciseId)?.name}
                    </div>
                    <div className="small muted">{last ? `Naposledy ${relativeDay(last.date)}` : 'Nový cvik'}</div>
                  </div>
                  {e.supersetId && <span className="badge" style={{ color: 'var(--purple)' }}>SS</span>}
                </div>
              );
            })}
          </div>
          <button className="btn primary block mt" onClick={() => start(preview)}>
            Začít trénink
          </button>
          <div className="grid-3 mt">
            <button className="btn sm" onClick={() => navigate(`/routines/${preview.id}`)}>
              ✏️ Upravit
            </button>
            <button
              className="btn sm"
              onClick={() => {
                saveRoutine({ ...structuredClone(preview), id: uid(), name: preview.name + ' (kopie)', createdAt: Date.now() });
                toast('Rutina zkopírována');
                setPreview(null);
              }}
            >
              ⧉ Kopie
            </button>
            <button
              className="btn sm danger"
              onClick={() => {
                if (window.confirm(`Smazat rutinu „${preview.name}“?`)) {
                  deleteRoutine(preview.id);
                  setPreview(null);
                }
              }}
            >
              🗑 Smazat
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
