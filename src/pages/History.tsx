import { useMemo, useState } from 'react';
import { useExerciseMap, useStore } from '../store/store';
import { WorkoutCard } from '../components/WorkoutCard';
import { Empty } from '../components/ui';
import { detectPRs, workoutVolume } from '../lib/calc';
import { fmtVolume, plural } from '../lib/format';

const DOW = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

export default function History() {
  const workouts = useStore((s) => s.workouts);
  const unit = useStore((s) => s.settings.unit);
  const exMap = useExerciseMap();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  });
  const [day, setDay] = useState<string | null>(null);

  const m = new Date(month);
  const next = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime();
  const inMonth = workouts.filter((w) => w.startedAt >= month && w.startedAt < next);
  const days = new Set(inMonth.map((w) => new Date(w.startedAt).toDateString()));
  const shown = day ? inMonth.filter((w) => new Date(w.startedAt).toDateString() === day) : inMonth;

  const prCounts = useMemo(() => {
    const map = new Map<string, number>();
    shown.forEach((w) => {
      const older = workouts.filter((x) => x.startedAt < w.startedAt);
      map.set(w.id, detectPRs(w, older, exMap).filter((p) => p.kind !== 'volume').length);
    });
    return map;
  }, [shown, workouts, exMap]);

  const firstDow = (m.getDay() + 6) % 7;
  const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const today = new Date().toDateString();
  const volume = inMonth.reduce((a, w) => a + workoutVolume(w, exMap), 0);

  const shift = (delta: number) => {
    setDay(null);
    setMonth(new Date(m.getFullYear(), m.getMonth() + delta, 1).getTime());
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Historie</h1>
        <span className="muted small">
          celkem {workouts.length} {plural(workouts.length, ['trénink', 'tréninky', 'tréninků'])}
        </span>
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Předchozí měsíc">
            ‹
          </button>
          <div className="center">
            <div className="bold" style={{ textTransform: 'capitalize' }}>
              {m.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}
            </div>
            <div className="tiny muted">
              {inMonth.length} {plural(inMonth.length, ['trénink', 'tréninky', 'tréninků'])} · {fmtVolume(volume, unit)}
            </div>
          </div>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Další měsíc">
            ›
          </button>
        </div>
        <div className="calendar">
          {DOW.map((d) => (
            <div key={d} className="dow">
              {d}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const ds = new Date(m.getFullYear(), m.getMonth(), d).toDateString();
            const has = days.has(ds);
            return (
              <button
                key={i}
                className={`day ${has ? 'has' : ''} ${ds === today ? 'today' : ''}`}
                style={day === ds ? { outline: '2px solid var(--text)', outlineOffset: -2 } : undefined}
                onClick={() => has && setDay(day === ds ? null : ds)}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div className="section stack">
        {day && (
          <button className="btn sm" onClick={() => setDay(null)}>
            Zobrazit celý měsíc
          </button>
        )}
        {shown.map((w) => (
          <WorkoutCard key={w.id} w={w} prCount={prCounts.get(w.id)} />
        ))}
        {!shown.length && (
          <Empty icon="📭" title="V tomto měsíci žádný trénink">
            {workouts.length ? 'Přepni na jiný měsíc šipkami nahoře.' : 'Tvoje dokončené tréninky se objeví tady.'}
          </Empty>
        )}
      </div>
    </div>
  );
}
