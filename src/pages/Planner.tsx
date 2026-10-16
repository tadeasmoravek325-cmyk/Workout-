import { Link, useNavigate } from 'react-router-dom';
import { useExerciseMap, useStore } from '../store/store';
import { startOfWeek } from '../lib/calc';

const DAYS = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'];

export default function Planner() {
  const routines = useStore((s) => s.routines);
  const schedule = useStore((s) => s.schedule);
  const setSchedule = useStore((s) => s.setSchedule);
  const workouts = useStore((s) => s.workouts);
  const weeklyGoal = useStore((s) => s.settings.weeklyGoal);
  const updateSettings = useStore((s) => s.updateSettings);
  const exMap = useExerciseMap();
  const navigate = useNavigate();
  const todayIdx = (new Date().getDay() + 6) % 7;
  const weekStart = startOfWeek(Date.now());
  const planned = Object.values(schedule).filter(Boolean).length;

  const doneOn = (i: number) => {
    const from = weekStart + i * 86_400_000;
    return workouts.find((w) => w.startedAt >= from && w.startedAt < from + 86_400_000);
  };

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          ‹ Zpět
        </button>
      </div>
      <h1>Plán týdne</h1>
      <p className="muted small">Přiřaď rutiny ke dnům. Na přehledu pak uvidíš, co máš dnes na programu.</p>

      {!routines.length ? (
        <div className="card empty">
          Nejdřív si vytvoř rutinu nebo importuj program.
          <div className="mt">
            <Link to="/train" className="btn soft sm">
              Přejít na rutiny
            </Link>
          </div>
        </div>
      ) : (
        <div className="list">
          {DAYS.map((d, i) => {
            const done = doneOn(i);
            const r = routines.find((x) => x.id === schedule[i]);
            return (
              <div key={d} className={`list-item ${i === todayIdx ? 'active' : ''}`} style={{ flexWrap: 'wrap' }}>
                <div style={{ width: 84 }}>
                  <div className="bold">{d}</div>
                  {done ? <div className="tiny ok">✓ odcvičeno</div> : i === todayIdx ? <div className="tiny accent">dnes</div> : null}
                </div>
                <select
                  className="grow"
                  value={schedule[i] ?? ''}
                  onChange={(e) => setSchedule(i, e.target.value || undefined)}
                >
                  <option value="">Volno 😴</option>
                  {routines.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.folder ? `${r.folder} – ` : ''}
                      {r.name}
                    </option>
                  ))}
                </select>
                {r && (
                  <div className="tiny muted ellipsis" style={{ width: '100%', paddingLeft: 94 }}>
                    {r.exercises.map((e) => exMap.get(e.exerciseId)?.name).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="card mt-l">
        <div className="row between">
          <div>
            <div className="bold">Týdenní cíl</div>
            <div className="small muted">Kolik tréninků týdně chceš stihnout</div>
          </div>
          <div className="row">
            <button className="icon-btn" onClick={() => updateSettings({ weeklyGoal: Math.max(1, weeklyGoal - 1) })}>
              −
            </button>
            <span className="bold" style={{ fontSize: 20, width: 24, textAlign: 'center' }}>
              {weeklyGoal}
            </span>
            <button className="icon-btn" onClick={() => updateSettings({ weeklyGoal: Math.min(7, weeklyGoal + 1) })}>
              +
            </button>
          </div>
        </div>
        {planned > 0 && planned !== weeklyGoal && (
          <button className="btn sm soft mt" onClick={() => updateSettings({ weeklyGoal: planned })}>
            Nastavit cíl podle plánu ({planned})
          </button>
        )}
      </div>
    </div>
  );
}
