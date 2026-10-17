import { useMemo, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import type { Workout } from '../types';
import { useExerciseMap, useStore } from '../store/store';
import { WorkoutCard } from '../components/WorkoutCard';
import { Empty } from '../components/ui';
import { doneSetCount, startOfWeek, workoutVolume } from '../lib/calc';
import { computeProgress, goalForWeek, isGoalWorkout, type GoalPlan } from '../lib/gamification';
import { fmtDate, fmtVolume, splitUnit } from '../lib/format';
import { LOCALE_TAG, t, tn } from '../i18n';
import './History.css';

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface WeekSummary {
  count: number;
  volume: number;
  sets: number;
}

function weekLabel(week: number, now = Date.now()): string {
  const thisWeek = startOfWeek(now);
  if (week === thisWeek) return t('This week');
  if (week === startOfWeek(thisWeek - 1)) return t('Last week');
  const sameYear = new Date(week).getFullYear() === new Date(now).getFullYear();
  return t('Week of {date}', {
    date: fmtDate(week, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }),
  });
}

export default function History() {
  const workouts = useStore((s) => s.workouts);
  const unit = useStore((s) => s.settings.unit);
  const weeklyGoal = useStore((s) => s.settings.weeklyGoal);
  const goalLog = useStore((s) => s.settings.goalLog);
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

  const goal: GoalPlan = useMemo(() => ({ current: weeklyGoal, log: goalLog }), [weeklyGoal, goalLog]);
  // Same record logic as Home and the XP system, so a tile shows the same PR count everywhere.
  const progress = useMemo(() => computeProgress(workouts, exMap, goal), [workouts, exMap, goal]);

  /** Totals per week over the whole history, so a week cut by the month view still shows its real total. */
  const weekStats = useMemo(() => {
    const map = new Map<number, WeekSummary>();
    for (const w of workouts) {
      const wk = startOfWeek(w.startedAt);
      const s = map.get(wk) ?? { count: 0, volume: 0, sets: 0 };
      if (isGoalWorkout(w)) s.count++;
      s.volume += workoutVolume(w, exMap);
      s.sets += doneSetCount(w);
      map.set(wk, s);
    }
    return map;
  }, [workouts, exMap]);

  const weeks = useMemo(() => {
    const out: { week: number; items: Workout[] }[] = [];
    for (const w of [...shown].sort((a, b) => b.startedAt - a.startedAt)) {
      const wk = startOfWeek(w.startedAt);
      const last = out[out.length - 1];
      if (last && last.week === wk) last.items.push(w);
      else out.push({ week: wk, items: [w] });
    }
    return out;
  }, [shown]);

  const firstDow = (m.getDay() + 6) % 7;
  const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const today = new Date().toDateString();
  const volume = inMonth.reduce((a, w) => a + workoutVolume(w, exMap), 0);

  const shift = (delta: number) => {
    setDay(null);
    setMonth(new Date(m.getFullYear(), m.getMonth() + delta, 1).getTime());
  };

  // Entrance order across headers and tiles; only the first few get a delay.
  let seq = 0;
  const enter = (): CSSProperties => ({ animationDelay: `${Math.min(seq++, 8) * 45}ms` });

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('History')}</h1>
        <span className="muted small">
          {tn(workouts.length, '{n} workout in total', '{n} workouts in total')}
        </span>
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <button className="icon-btn" onClick={() => shift(-1)} aria-label={t('Previous month')}>
            <ChevronLeft size={22} />
          </button>
          <div className="center">
            <div className="bold" style={{ textTransform: 'capitalize' }}>
              {m.toLocaleDateString(LOCALE_TAG, { month: 'long', year: 'numeric' })}
            </div>
            <div className="tiny muted">
              {tn(inMonth.length, '{n} workout', '{n} workouts')} · {fmtVolume(volume, unit)}
            </div>
          </div>
          <button className="icon-btn" onClick={() => shift(1)} aria-label={t('Next month')}>
            <ChevronRight size={22} />
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

      <div className="section" key={`${month}|${day ?? ''}`}>
        {day && (
          <button className="btn sm hist-all" onClick={() => setDay(null)}>
            {t('Show whole month')}
          </button>
        )}
        {weeks.map(({ week, items }) => {
          const s = weekStats.get(week) ?? { count: items.length, volume: 0, sets: 0 };
          const target = goalForWeek(goal, week);
          const hit = progress.goalWeeks.has(week);
          const [volV, volU] = splitUnit(fmtVolume(s.volume, unit));
          return (
            <section key={week} className="hist-week">
              <header className="hist-week-head hist-in" style={enter()}>
                <div className="hist-week-top">
                  <h2>{weekLabel(week)}</h2>
                  {hit && (
                    <span className="hist-goal">
                      <Flame size={16} strokeWidth={2.6} />
                      {t('Goal hit')}
                    </span>
                  )}
                </div>
                <div className="hist-week-sum">
                  <span
                    className="hist-pips"
                    role="img"
                    aria-label={t('{done} of {goal} workouts', { done: s.count, goal: target })}
                  >
                    {Array.from({ length: Math.max(target, s.count) }, (_, i) => (
                      <i key={i} className={i < s.count ? (i < target ? 'on' : 'on extra') : ''} />
                    ))}
                  </span>
                  <span>
                    <b>{s.count}</b>
                    {target > 0 && <b className="of">/{target}</b>} {tn(s.count, 'workout', 'workouts')}
                  </span>
                  <span>
                    <b>{volV}</b> {volU}
                  </span>
                  <span>
                    <b>{s.sets}</b> {tn(s.sets, 'set', 'sets')}
                  </span>
                </div>
              </header>
              <div className="stack">
                {items.map((w) => (
                  <div key={w.id} className="hist-in" style={enter()}>
                    <WorkoutCard w={w} prCount={progress.perWorkout.get(w.id)?.prExercises.length} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {!shown.length && (
          <Empty title={t('No workouts this month')}>
            {workouts.length ? t('Use the arrows above to switch months.') : t('Your finished workouts will show up here.')}
          </Empty>
        )}
      </div>
    </div>
  );
}
