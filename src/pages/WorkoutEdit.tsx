import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/store';
import { WorkoutEditor } from '../components/WorkoutEditor';
import { t } from '../i18n';

function toLocalInput(ts: number) {
  const d = new Date(ts);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function WorkoutEdit() {
  const { id = '' } = useParams();
  const workout = useStore((s) => s.workouts.find((w) => w.id === id));
  const mutateWorkout = useStore((s) => s.mutateWorkout);
  const navigate = useNavigate();
  if (!workout) return <Navigate to="/history" replace />;
  const mutate = (fn: Parameters<typeof mutateWorkout>[1]) => mutateWorkout(id, fn);
  const durMin = Math.round(((workout.finishedAt ?? workout.startedAt) - workout.startedAt) / 60000);

  return (
    <div className="page">
      <div className="page-header">
        <span />
        <h2>{t('Edit workout')}</h2>
        <button className="btn ok sm" onClick={() => navigate(`/history/${id}`, { replace: true })}>
          {t('Done')}
        </button>
      </div>
      <div className="stack">
        <input
          className="wk-title"
          value={workout.name}
          onChange={(e) => {
            const v = e.target.value;
            mutate((w) => {
              w.name = v;
            });
          }}
        />
        <div className="grid-2">
          <div className="field">
            <label>{t('Start time')}</label>
            <input
              type="datetime-local"
              value={toLocalInput(workout.startedAt)}
              onChange={(e) => {
                const ts = new Date(e.target.value).getTime();
                if (!Number.isNaN(ts))
                  mutate((w) => {
                    const dur = (w.finishedAt ?? w.startedAt) - w.startedAt;
                    w.startedAt = ts;
                    w.finishedAt = ts + dur;
                  });
              }}
            />
          </div>
          <div className="field">
            <label>{t('Duration (min)')}</label>
            <input
              inputMode="numeric"
              value={durMin}
              onChange={(e) => {
                const m = Number(e.target.value);
                if (!Number.isNaN(m))
                  mutate((w) => {
                    w.finishedAt = w.startedAt + m * 60000;
                  });
              }}
            />
          </div>
        </div>
      </div>
      <WorkoutEditor workout={workout} mutate={mutate} live={false} />
    </div>
  );
}
