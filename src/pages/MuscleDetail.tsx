import { useMemo } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAllExercises, useExerciseMap, useStore } from '../store/store';
import { isWorkingSet, muscleRecovery, startOfWeek } from '../lib/calc';
import { fmtNum, relativeDay } from '../lib/format';
import { MUSCLE_LABELS, muscleLoad } from '../data/exercises';
import { BodyMap, IDLE, volumeColor } from '../components/BodyMap';
import { ExerciseAvatar } from '../components/ExercisePicker';
import { Empty } from '../components/ui';
import { t, tn } from '../i18n';
import { useGame } from '../lib/useGame';
import { prevWeek } from '../lib/gamification';
import type { Muscle } from '../types';

const WEEKS = 8;

export default function MuscleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const workouts = useStore((s) => s.workouts);
  const equipment = useStore((s) => s.settings.equipment);
  const exMap = useExerciseMap();
  const all = useAllExercises();
  const muscle = id as Muscle;
  const valid = !!id && id in MUSCLE_LABELS;

  const { weekly, last, used } = useMemo(() => {
    // Step with prevWeek, not a fixed 7 days, so weeks still line up across DST changes.
    const weekly: { week: number; sets: number }[] = [];
    for (let wk = startOfWeek(Date.now()), i = 0; i < WEEKS; i++, wk = prevWeek(wk)) weekly.unshift({ week: wk, sets: 0 });
    let last: number | undefined;
    const used = new Map<string, number>();
    for (const w of workouts) {
      for (const we of w.exercises) {
        const ex = exMap.get(we.exerciseId);
        const share = ex ? (muscleLoad(ex)[muscle] ?? 0) : 0;
        if (!share) continue;
        const n = we.sets.filter((s) => s.done && isWorkingSet(s)).length;
        if (!n) continue;
        if (share >= 0.5 && (last === undefined || w.startedAt > last)) last = w.startedAt;
        used.set(we.exerciseId, (used.get(we.exerciseId) ?? 0) + n);
        const row = weekly.find((r) => r.week === startOfWeek(w.startedAt));
        if (row) row.sets += n * share;
      }
    }
    return { weekly, last, used };
  }, [workouts, exMap, muscle]);

  const game = useGame();
  const recovery = useMemo(() => muscleRecovery(workouts.slice(0, 30), exMap)[muscle], [workouts, exMap, muscle]);

  const best = useMemo(
    () =>
      all
        .map((e) => ({ e, share: muscleLoad(e)[muscle] ?? 0 }))
        .filter((x) => x.share >= 0.5 && equipment.includes(x.e.equipment))
        .sort((a, b) => b.share - a.share || (used.get(b.e.id) ?? 0) - (used.get(a.e.id) ?? 0) || a.e.name.localeCompare(b.e.name))
        .slice(0, 10),
    [all, muscle, equipment, used],
  );

  if (!valid) return <Navigate to="/stats" replace />;

  const thisWeek = weekly[WEEKS - 1].sets;
  const avg = weekly.slice(0, WEEKS - 1).reduce((a, r) => a + r.sets, 0) / (WEEKS - 1);
  const top = Math.max(20, ...weekly.map((r) => r.sets));

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          ‹ {t('Back')}
        </button>
      </div>
      <h1>{MUSCLE_LABELS[muscle]}</h1>
      {(() => {
        const f = game.muscles[muscle];
        return (
          <div className="card mt row" style={{ gap: 14 }}>
            <div className="muscle-level" style={{ background: 'none', padding: 0 }}>
              <span className="lv" style={{ width: 44, height: 44, fontSize: 22, borderRadius: 14 }}>
                {f.level}
              </span>
            </div>
            <div className="grow">
              <div className="row between small bold">
                <span>{t('Level {n}', { n: f.level })}</span>
                <span className="muted">
                  {f.nextAt ? t('{done} / {next} sets', { done: fmtNum(f.lifetime, 0), next: f.nextAt }) : t('Max level')}
                </span>
              </div>
              <div className="xp-bar" style={{ marginTop: 6 }}>
                <div style={{ width: `${f.nextAt ? Math.min(1, f.lifetime / f.nextAt) * 100 : 100}%` }} />
              </div>
              <div className="small muted" style={{ marginTop: 6 }}>
                {t('Form {n} %', { n: Math.round(f.form * 100) })} ·{' '}
                {f.form >= 0.8 ? t('in great shape') : f.form >= 0.4 ? t('could use some work') : f.level ? t('fading, train it soon') : t('not trained yet')}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="card mt">
        <BodyMap height={220} color={(m) => (m === muscle ? 'var(--accent)' : IDLE)} value={(m) => (m === muscle ? 1 : 0)} />
      </div>

      <div className="grid-3 mt">
        <div className="stat">
          <div className="v">{fmtNum(thisWeek, 1)}</div>
          <div className="l">{t('Sets this week')}</div>
        </div>
        <div className="stat">
          <div className="v">{fmtNum(avg, 1)}</div>
          <div className="l">{t('Weekly average')}</div>
        </div>
        <div className="stat">
          <div className="v">{recovery === undefined ? '–' : `${Math.round(recovery * 100)} %`}</div>
          <div className="l">{t('Recovered')}</div>
        </div>
      </div>
      <div className="small muted mt">
        {last ? t('Last trained hard: {when}', { when: relativeDay(last) }) : t('Not trained yet.')}{' '}
        {t('Sets count fully when this is the main muscle and partly when it assists.')}
      </div>

      <div className="section">
        <div className="section-title">
          <h2>{t('Last {n} weeks', { n: WEEKS })}</h2>
          <span className="small muted">{t('10–20 sets is the sweet spot')}</span>
        </div>
        <div className="card">
          <div className="week-bars">
            {weekly.map((r) => (
              <div key={r.week} className="col">
                <span className="tiny muted">{r.sets ? fmtNum(r.sets, 0) : ''}</span>
                <div className="bar" style={{ height: `${(r.sets / top) * 100}%`, background: r.sets ? volumeColor(r.sets) : undefined }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>{t('Exercises that train it')}</h2>
        </div>
        {best.length ? (
          <div className="list">
            {best.map(({ e, share }) => (
              <Link key={e.id} to={`/exercises/${e.id}`} className="list-item">
                <ExerciseAvatar ex={e} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="bold ellipsis">{e.name}</div>
                  <div className="small muted">
                    {share >= 1 ? t('Main muscle') : t('Strong helper')}
                    {used.get(e.id) ? ` · ${tn(used.get(e.id)!, '{n} set done', '{n} sets done')}` : ''}
                  </div>
                </div>
                <span className="chev" />
              </Link>
            ))}
          </div>
        ) : (
          <Empty title={t('Nothing with your equipment')}>{t('Add more equipment in Settings to see exercises.')}</Empty>
        )}
      </div>
    </div>
  );
}
