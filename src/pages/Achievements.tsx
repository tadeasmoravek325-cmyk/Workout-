import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExerciseMap, useStore } from '../store/store';
import { ACHIEVEMENTS, achievementStats } from '../lib/achievements';

export default function Achievements() {
  const workouts = useStore((s) => s.workouts);
  const measurements = useStore((s) => s.measurements);
  const exMap = useExerciseMap();
  const navigate = useNavigate();
  const stats = useMemo(() => achievementStats(workouts, exMap, measurements), [workouts, exMap, measurements]);
  const items = ACHIEVEMENTS.map((a) => ({ a, p: a.progress(stats) })).sort((x, y) => Number(y.p >= 1) - Number(x.p >= 1) || y.p - x.p);
  const unlocked = items.filter((x) => x.p >= 1).length;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          ‹ Zpět
        </button>
      </div>
      <h1>Odznaky</h1>
      <div className="muted small" style={{ marginBottom: 12 }}>
        Odemčeno {unlocked} z {ACHIEVEMENTS.length}
      </div>
      <div className="progress" style={{ marginBottom: 16 }}>
        <div style={{ width: `${(unlocked / ACHIEVEMENTS.length) * 100}%` }} />
      </div>
      <div className="stack">
        {items.map(({ a, p }) => (
          <div key={a.id} className={`card ach ${p >= 1 ? '' : 'locked'}`}>
            <div className="ico">{a.icon}</div>
            <div className="grow">
              <div className="row between">
                <span className="bold">{a.title}</span>
                {p >= 1 ? <span className="badge gold">Získáno</span> : <span className="small muted">{Math.floor(p * 100)} %</span>}
              </div>
              <div className="small muted">{a.description}</div>
              {p < 1 && p > 0 && (
                <div className="progress" style={{ height: 5, marginTop: 6 }}>
                  <div style={{ width: `${p * 100}%` }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
