import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useExerciseMap, useStore } from '../store/store';
import { coachInsights } from '../lib/insights';
import { defaultFocus } from '../core/progress/engine';
import { overloadOverview } from '../lib/overload';
import { targetForExercise } from '../core/progress/ranges';
import { describeDelta } from '../components/OverloadPanel';
import { RangeSuggestions } from '../components/RangeSuggestions';
import { BackLabel, Empty } from '../components/ui';
import { t } from '../i18n';

/** Coach notes and progressive overload across all lifts. */
export default function Coach() {
  const navigate = useNavigate();
  const workouts = useStore((s) => s.workouts);
  const exMap = useExerciseMap();
  const settings = useStore((s) => s.settings);
  const insights = useMemo(() => coachInsights(workouts, exMap, Date.now(), defaultFocus(settings)), [workouts, exMap, settings]);
  const overload = useMemo(
    () => overloadOverview(workouts, exMap, (id) => { const e = exMap.get(id); return e ? targetForExercise(e, settings).repMin : 1; }),
    [workouts, exMap, settings],
  );
  const label = { up: t('Progressing'), flat: t('Plateau'), down: t('Going backwards'), new: '' } as const;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          <BackLabel />
        </button>
      </div>
      <h1 style={{ fontSize: 24 }}>{t('Coach')}</h1>


      <RangeSuggestions />

      {!insights.length && !overload.length && <Empty title={t('Not enough data yet')}>{t('Log a few workouts and the coach will have something to say.')}</Empty>}

      {insights.length > 0 && (
        <div className="card mt">
          {insights.map((i) => (
            <div key={i.text} className="small" style={{ margin: '6px 0' }}>
              {i.text}
            </div>
          ))}
        </div>
      )}

      {overload.length > 0 && (
        <div className="card mt">
          <div className="row between">
            <div className="bold">{t('Progressive overload')}</div>
            <div className="small muted">{t('{up} of {n} lifts progressing', { up: overload.filter((r) => r.state === 'up').length, n: overload.length })}</div>
          </div>
          {overload.map((r) => (
            <Link key={r.exercise.id} to={`/exercises/${r.exercise.id}`} className="row between small" style={{ padding: '7px 0' }}>
              <span className="ellipsis">{r.exercise.name}</span>
              <span className={`overload-${r.state}`}>
                {label[r.state]} {r.moreWork ? t('more work') : describeDelta(r.delta, settings.unit)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
