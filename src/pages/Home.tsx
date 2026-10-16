import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useExerciseMap, useStore } from '../store/store';
import {
  detectPRs,
  muscleRecovery,
  startOfWeek,
  weekStreak,
  workoutVolume,
  workoutsThisWeek,
} from '../lib/calc';
import { fmtNum, fmtVolume, plural, relativeDay, toDisplayWeight } from '../lib/format';
import { Ring } from '../components/ui';
import { BodyMap, recoveryColor } from '../components/BodyMap';
import { WorkoutCard } from '../components/WorkoutCard';
import { MUSCLE_LABELS } from '../data/exercises';
import { ACHIEVEMENTS, achievementStats } from '../lib/achievements';
import type { Muscle } from '../types';

const DAY_NAMES = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle'];

export default function Home() {
  const workouts = useStore((s) => s.workouts);
  const routines = useStore((s) => s.routines);
  const settings = useStore((s) => s.settings);
  const schedule = useStore((s) => s.schedule);
  const measurements = useStore((s) => s.measurements);
  const active = useStore((s) => s.active);
  const startWorkout = useStore((s) => s.startWorkout);
  const exMap = useExerciseMap();
  const navigate = useNavigate();

  const thisWeek = workoutsThisWeek(workouts);
  const streak = weekStreak(workouts, settings.weeklyGoal);
  const weekStart = startOfWeek(Date.now());
  const weekVolume = workouts.filter((w) => w.startedAt >= weekStart).reduce((a, w) => a + workoutVolume(w, exMap), 0);

  const todayIdx = (new Date().getDay() + 6) % 7;
  const todayRoutine = routines.find((r) => r.id === schedule[todayIdx]);
  const doneToday = workouts.some((w) => new Date(w.startedAt).toDateString() === new Date().toDateString());

  const recovery = useMemo(() => muscleRecovery(workouts.slice(0, 30), exMap), [workouts, exMap]);
  const ready = (Object.entries(recovery) as [Muscle, number][]).filter(([, v]) => v >= 0.95).map(([m]) => m);
  const tired = (Object.entries(recovery) as [Muscle, number][]).filter(([, v]) => v < 0.6).map(([m]) => m);

  const recentPRs = useMemo(() => {
    const out: { workoutId: string; date: number; exerciseId: string; kind: string; value: number }[] = [];
    workouts.slice(0, 8).forEach((w, i) => {
      for (const pr of detectPRs(w, workouts.slice(i + 1), exMap)) {
        if (pr.kind === 'weight' || pr.kind === 'reps' || pr.kind === 'duration' || pr.kind === 'distance')
          out.push({ workoutId: w.id, date: w.startedAt, exerciseId: pr.exerciseId, kind: pr.kind, value: pr.value });
      }
    });
    return out.slice(0, 5);
  }, [workouts, exMap]);

  const nextAchievement = useMemo(() => {
    const stats = achievementStats(workouts, exMap, measurements);
    return ACHIEVEMENTS.map((a) => ({ a, p: a.progress(stats) }))
      .filter((x) => x.p < 1)
      .sort((x, y) => y.p - x.p)[0];
  }, [workouts, exMap, measurements]);

  const hour = new Date().getHours();
  const greeting = hour < 10 ? 'Dobré ráno' : hour < 18 ? 'Ahoj' : 'Dobrý večer';

  const start = (routineId?: string) => {
    const r = routines.find((x) => x.id === routineId);
    startWorkout(r);
    navigate('/workout');
  };

  const unit = settings.unit;
  const fmtPr = (kind: string, value: number) =>
    kind === 'weight'
      ? `${fmtNum(toDisplayWeight(value, unit))} ${unit}`
      : kind === 'reps'
        ? `${value} opak.`
        : kind === 'duration'
          ? `${Math.round(value)} s`
          : `${fmtNum(value, 2)} km`;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="small muted">
            {new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1>{greeting} 👋</h1>
        </div>
        <Link to="/settings" className="icon-btn" aria-label="Nastavení">
          ⚙️
        </Link>
      </div>

      <div className="card row" style={{ gap: 16 }}>
        <Ring value={thisWeek / settings.weeklyGoal}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>
            {thisWeek}/{settings.weeklyGoal}
          </div>
          <div className="tiny muted">tento týden</div>
        </Ring>
        <div className="grow stack" style={{ gap: 6 }}>
          <div>
            <span style={{ fontSize: 22, fontWeight: 800 }}>🔥 {streak}</span>{' '}
            <span className="muted small">{plural(streak, ['týden', 'týdny', 'týdnů'])} v řadě</span>
          </div>
          <div className="small muted">Objem tento týden: {fmtVolume(weekVolume, unit)}</div>
          <div className="small">
            {thisWeek >= settings.weeklyGoal
              ? 'Týdenní cíl splněn! 🎉'
              : `Do cíle zbývá ${settings.weeklyGoal - thisWeek} ${plural(settings.weeklyGoal - thisWeek, ['trénink', 'tréninky', 'tréninků'])}.`}
          </div>
        </div>
      </div>

      <div className="section">
        {active ? (
          <Link to="/workout" className="card tap row" style={{ borderColor: 'var(--accent)' }}>
            <div className="grow">
              <div className="small accent bold">Probíhá trénink</div>
              <h3>{active.name}</h3>
            </div>
            <span className="btn primary sm">Pokračovat</span>
          </Link>
        ) : todayRoutine && !doneToday ? (
          <div className="card">
            <div className="small accent bold">Dnes na plánu ({DAY_NAMES[todayIdx]})</div>
            <h2 style={{ margin: '4px 0 6px' }}>{todayRoutine.name}</h2>
            <div className="small muted ellipsis">
              {todayRoutine.exercises.map((e) => exMap.get(e.exerciseId)?.name).join(', ')}
            </div>
            <button className="btn primary block mt" onClick={() => start(todayRoutine.id)}>
              Začít trénink
            </button>
          </div>
        ) : (
          <div className="grid-2">
            <button className="btn primary" onClick={() => start()}>
              + Prázdný trénink
            </button>
            <Link to="/train" className="btn">
              Rutiny a programy
            </Link>
          </div>
        )}
      </div>

      {Object.keys(recovery).length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>Připravenost svalů</h2>
            <Link to="/stats">Statistiky</Link>
          </div>
          <div className="card">
            <BodyMap color={(m) => recoveryColor(recovery[m])} height={220} />
            <div className="row small" style={{ justifyContent: 'center', gap: 14 }}>
              <span>
                <span style={{ color: '#ff4d5e' }}>●</span> unavené
              </span>
              <span>
                <span style={{ color: '#f1c40f' }}>●</span> regenerují
              </span>
              <span>
                <span style={{ color: '#2ecc71' }}>●</span> připravené
              </span>
            </div>
            {ready.length > 0 && (
              <div className="small mt">
                <span className="ok bold">Připravené:</span> {ready.map((m) => MUSCLE_LABELS[m]).join(', ')}
              </div>
            )}
            {tired.length > 0 && (
              <div className="small" style={{ marginTop: 4 }}>
                <span className="danger bold">Ještě odpočívají:</span> {tired.map((m) => MUSCLE_LABELS[m]).join(', ')}
              </div>
            )}
          </div>
        </div>
      )}

      {recentPRs.length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>Nedávné rekordy</h2>
          </div>
          <div className="list">
            {recentPRs.map((p, i) => (
              <Link key={i} to={`/exercises/${p.exerciseId}`} className="list-item">
                <span style={{ fontSize: 22 }}>🏆</span>
                <div className="grow">
                  <div className="bold ellipsis">{exMap.get(p.exerciseId)?.name}</div>
                  <div className="small muted">{relativeDay(p.date)}</div>
                </div>
                <span className="badge gold">{fmtPr(p.kind, p.value)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {nextAchievement && (
        <div className="section">
          <div className="section-title">
            <h2>Další odznak</h2>
            <Link to="/achievements">Všechny</Link>
          </div>
          <div className="card ach">
            <div className="ico">{nextAchievement.a.icon}</div>
            <div className="grow">
              <div className="bold">{nextAchievement.a.title}</div>
              <div className="small muted">{nextAchievement.a.description}</div>
              <div className="progress mt" style={{ height: 6 }}>
                <div style={{ width: `${nextAchievement.p * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-title">
          <h2>Poslední tréninky</h2>
          <Link to="/history">Historie</Link>
        </div>
        {workouts.length ? (
          <div className="stack">
            {workouts.slice(0, 3).map((w) => (
              <WorkoutCard key={w.id} w={w} />
            ))}
          </div>
        ) : (
          <div className="card empty">
            <div className="big">💪</div>
            <div className="bold" style={{ color: 'var(--text)' }}>
              Zatím žádný trénink
            </div>
            Začni prázdným tréninkem, nebo si vyber hotový program v sekci Trénink.
            <div className="mt">
              <Link to="/settings" className="btn sm soft">
                Importovat data ze Strong
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
