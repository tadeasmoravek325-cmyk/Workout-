import { useState } from 'react';
import { Copy, Folder, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useExerciseMap, useStore } from '../store/store';
import { PROGRAMS, type Program } from '../data/programs';
import { confirmDialog, Sheet, toast, undoToast } from '../components/ui';
import { GeneratorSheet } from '../components/GeneratorSheet';
import { Sparkles } from 'lucide-react';
import { exerciseHistory } from '../lib/calc';
import { relativeDay } from '../lib/format';
import { t, tn } from '../i18n';
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
  const [generator, setGenerator] = useState(false);

  const start = (r?: Routine) => {
    if (active) {
      toast(t('You already have a workout going'));
      navigate('/workout');
      return;
    }
    startWorkout(r);
    navigate('/workout');
  };

  const folders = new Map<string, Routine[]>();
  for (const r of routines) {
    const f = r.folder || t('My routines');
    folders.set(f, [...(folders.get(f) ?? []), r]);
  }

  const lastDone = (r: Routine) => workouts.find((w) => w.routineId === r.id)?.startedAt;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('Workout')}</h1>
      </div>

      <button className="btn primary block" onClick={() => start()}>
        {active ? `▶ ${t('Resume workout')}` : `+ ${t('Start empty workout')}`}
      </button>
      {!active && (
        <button className="btn cool block mt" onClick={() => setGenerator(true)}>
          <Sparkles size={18} /> {t('Generate a custom workout')}
        </button>
      )}

      <div className="section">
        <div className="section-title">
          <h2>{t('Routines')}</h2>
          <Link to="/routines/new">+ {t('New routine')}</Link>
        </div>
        {!routines.length && (
          <div className="card empty">
            {t('No routines yet. Build your own, or grab a ready-made program below.')}
          </div>
        )}
        {[...folders.entries()].map(([folder, list]) => (
          <div key={folder} style={{ marginBottom: 14 }}>
            <div className="small muted bold" style={{ margin: '6px 2px' }}>
              <Folder size={13} style={{ verticalAlign: '-2px' }} /> {folder}
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
                      {last ? t('Last done: {when}', { when: relativeDay(last) }) : t('Not done yet')}
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
          <h2>{t('Ready-made programs')}</h2>
        </div>
        <div className="stack">
          {PROGRAMS.map((p) => (
            <button key={p.id} className="card tap" style={{ textAlign: 'left' }} onClick={() => setProgram(p)}>
              <div className="row between">
                <h3>{p.name}</h3>
                <span className="badge accent">{t('{n}× a week', { n: p.daysPerWeek })}</span>
              </div>
              <div className="small muted" style={{ marginTop: 4 }}>
                {p.level} · {p.goal}
              </div>
            </button>
          ))}
        </div>
      </div>

      {generator && <GeneratorSheet onClose={() => setGenerator(false)} />}

      {program && (
        <Sheet title={program.name} onClose={() => setProgram(null)}>
          <p className="muted" style={{ marginTop: 0 }}>
            {program.description}
          </p>
          <div className="row" style={{ gap: 6 }}>
            <span className="badge">{program.level}</span>
            <span className="badge">{program.goal}</span>
            <span className="badge">{t('{n}× a week', { n: program.daysPerWeek })}</span>
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
              toast(tn(n, 'Added {n} routine to the “{folder}” folder', 'Added {n} routines to the “{folder}” folder', { folder: program.name }));
              setProgram(null);
            }}
          >
            {t('Add to my routines')}
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
                    <div className="small muted">{last ? t('Last done {when}', { when: relativeDay(last.date) }) : t('New exercise')}</div>
                  </div>
                  {e.supersetId && <span className="badge" style={{ color: 'var(--purple)' }}>SS</span>}
                </div>
              );
            })}
          </div>
          <button className="btn primary block mt" onClick={() => start(preview)}>
            {t('Start workout')}
          </button>
          <div className="grid-3 mt">
            <button className="btn sm" onClick={() => navigate(`/routines/${preview.id}`)}>
              <Pencil size={15} /> {t('Edit')}
            </button>
            <button
              className="btn sm"
              onClick={() => {
                saveRoutine({ ...structuredClone(preview), id: uid(), name: t('{name} (copy)', { name: preview.name }), createdAt: Date.now() });
                toast(t('Routine copied'));
                setPreview(null);
              }}
            >
              <Copy size={15} /> {t('Copy')}
            </button>
            <button
              className="btn sm danger"
              onClick={async () => {
                if (await confirmDialog(t('Delete routine “{name}”?', { name: preview.name }), t('Your finished workouts stay in history.'), t('Delete'))) {
                  const copy = structuredClone(preview);
                  const days = Object.entries(useStore.getState().schedule)
                    .filter(([, id]) => id === preview.id)
                    .map(([d]) => Number(d));
                  deleteRoutine(preview.id);
                  setPreview(null);
                  undoToast(t('Routine deleted'), () => {
                    const st = useStore.getState();
                    st.saveRoutine(copy);
                    for (const d of days) st.setSchedule(d, copy.id);
                  });
                }
              }}
            >
              <Trash2 size={15} /> {t('Delete')}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
