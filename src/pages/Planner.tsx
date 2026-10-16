import { Link, useNavigate } from 'react-router-dom';
import { useExerciseMap, useStore } from '../store/store';
import { startOfWeek } from '../lib/calc';
import { t } from '../i18n';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
          ‹ {t('Back')}
        </button>
      </div>
      <h1>{t('Weekly plan')}</h1>
      <p className="muted small">{t('Assign routines to days. Your home screen will then show what’s on for today.')}</p>

      {!routines.length ? (
        <div className="card empty">
          {t('Create a routine or add a program first.')}
          <div className="mt">
            <Link to="/train" className="btn soft sm">
              {t('Go to routines')}
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
                  <div className="bold">{t(d)}</div>
                  {done ? <div className="tiny ok">{t('done')}</div> : i === todayIdx ? <div className="tiny accent">{t('today')}</div> : null}
                </div>
                <select
                  className="grow"
                  value={schedule[i] ?? ''}
                  onChange={(e) => setSchedule(i, e.target.value || undefined)}
                >
                  <option value="">{t('Rest day')}</option>
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
            <div className="bold">{t('Weekly goal')}</div>
            <div className="small muted">{t('How many workouts you want to fit in each week')}</div>
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
            {t('Match goal to plan ({n})', { n: planned })}
          </button>
        )}
      </div>
    </div>
  );
}
