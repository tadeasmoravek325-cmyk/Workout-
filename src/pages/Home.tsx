import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Plus, RotateCcw, Settings as SettingsIcon, Trophy } from 'lucide-react';
import { useExerciseMap, useStore } from '../store/store';
import { nextRoutine, startOfWeek, workoutVolume } from '../lib/calc';
import { fmtVolume, relativeDay } from '../lib/format';
import { LOCALE_TAG, t, tn } from '../i18n';
import { WorkoutCard } from '../components/WorkoutCard';
import { useGame } from '../lib/useGame';
import { backupDue, saveBackupFile } from '../lib/backup';
import { cloudConfigured, useCloud } from '../lib/cloud';
import { SignInSheet } from '../components/Account';

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY = 86_400_000;


export default function Home() {
  const workouts = useStore((s) => s.workouts);
  const routines = useStore((s) => s.routines);
  const settings = useStore((s) => s.settings);
  const schedule = useStore((s) => s.schedule);
  const active = useStore((s) => s.active);
  const startWorkout = useStore((s) => s.startWorkout);
  const repeatWorkout = useStore((s) => s.repeatWorkout);
  const exMap = useExerciseMap();
  const navigate = useNavigate();
  const game = useGame();
  // Signed-in users are backed up continuously, so the manual backup reminder is not needed.
  const cloudUser = useCloud((s) => s.user);
  const [signIn, setSignIn] = useState(false);

  const weekStart = startOfWeek(Date.now());
  const thisWeek = workouts.filter((w) => w.startedAt >= weekStart);
  const weekVolume = thisWeek.reduce((a, w) => a + workoutVolume(w, exMap), 0);

  const todayIdx = (new Date().getDay() + 6) % 7;
  const todayRoutine = routines.find((r) => r.id === schedule[todayIdx]);
  const doneToday = workouts.some((w) => new Date(w.startedAt).toDateString() === new Date().toDateString());
  const upNext = todayRoutine ?? nextRoutine(routines, workouts);
  const last = workouts[0];

  const recentPRs = useMemo(() => {
    const out: { date: number; exerciseId: string }[] = [];
    for (const w of workouts.slice(0, 10)) {
      for (const id of game.progress.perWorkout.get(w.id)?.prExercises ?? []) out.push({ date: w.startedAt, exerciseId: id });
    }
    return out.slice(0, 4);
  }, [workouts, game.progress]);

  const hour = new Date().getHours();
  const greeting = hour < 10 ? t('Good morning') : hour < 18 ? t('Hey') : t('Good evening');
  const name = settings.name ? `, ${settings.name}` : '';
  const unit = settings.unit;

  const start = (routineId?: string) => {
    const r = routines.find((x) => x.id === routineId);
    startWorkout(r);
    navigate('/workout');
  };

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 14 }}>
        <div className="grow">
          <div className="small muted bold">
            {new Date().toLocaleDateString(LOCALE_TAG, { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase())}
          </div>
          <h1 className="ellipsis">
            {greeting}
            {name}
          </h1>
        </div>
        <Link to="/settings" className="icon-btn" aria-label={t('Settings')}>
          <SettingsIcon size={19} />
        </Link>
      </div>

      {/* Week */}
      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3>{t('This week')}</h3>
          <span className="small bold">
            <span className="accent">{thisWeek.length}</span>
            <span className="muted">
              {' '}
              / {tn(settings.weeklyGoal, '{n} workout', '{n} workouts')} · {fmtVolume(weekVolume, unit)}
            </span>
          </span>
        </div>
        <div className="week-dots">
          {DOW.map((d, i) => {
            const from = weekStart + i * DAY;
            const done = workouts.some((w) => w.startedAt >= from && w.startedAt < from + DAY);
            const planned = !!schedule[i] && !done && i >= todayIdx;
            return (
              <div key={d} className="d">
                <div className={`dot ${done ? 'done' : ''} ${planned ? 'planned' : ''} ${i === todayIdx ? 'today' : ''}`}>
                  {done ? <Check size={18} strokeWidth={3.5} /> : planned ? '•' : ''}
                </div>
                {d}
              </div>
            );
          })}
        </div>
        {game.streak.streak > 0 && (
          <div className="small muted" style={{ marginTop: 10 }}>
            {t('Streak')}: <b>{game.streak.streak}</b> {tn(game.streak.streak, 'week', 'weeks')}
          </div>
        )}
      </div>

      {cloudConfigured && !cloudUser && (
        <div className="card backup-nudge mt">
          <div className="bold">{t('Keep your data on every device')}</div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {t('Sign in once and your profile, workouts and Strong import come back automatically, even on a new phone or after clearing the browser.')}
          </div>
          <button className="btn primary sm block mt" onClick={() => setSignIn(true)}>
            {t('Sign in or create account')}
          </button>
        </div>
      )}
      {signIn && <SignInSheet onClose={() => setSignIn(false)} />}

      {!cloudUser && backupDue(workouts.length, settings.lastBackupAt, settings.backupSnoozeUntil) && (
        <div className="card backup-nudge mt">
          <div className="bold">{t('Back up your workouts')}</div>
          <div className="small muted" style={{ marginTop: 4 }}>
            {tn(
              workouts.length,
              'You have {n} workout saved only on this phone. If you lose the phone, it is gone.',
              'You have {n} workouts saved only on this phone. If you lose the phone, they are gone.',
            )}
            {settings.lastBackupAt ? ` ${t('Last backup: {when}.', { when: relativeDay(settings.lastBackupAt) })}` : ''}
          </div>
          <div className="row mt" style={{ gap: 8 }}>
            <button className="btn primary sm grow" onClick={() => void saveBackupFile()}>
              {t('Save backup')}
            </button>
            <button
              className="btn sm"
              onClick={() => useStore.getState().updateSettings({ backupSnoozeUntil: Date.now() + 7 * DAY })}
            >
              {t('In a week')}
            </button>
          </div>
        </div>
      )}

      {/* Start */}
      <div className="section" style={{ marginTop: 16 }}>
        {active ? (
          <Link to="/workout" className="card tap row" style={{ borderColor: 'var(--accent)' }}>
            <div className="grow">
              <div className="small accent bold">
                <span className="pulse" style={{ background: 'var(--accent)', width: 8, height: 8, borderRadius: 9, display: 'inline-block', marginRight: 6 }} />
                {t('Workout in progress')}
              </div>
              <h3>{active.name}</h3>
            </div>
            <span className="btn primary sm">{t('Resume')}</span>
          </Link>
        ) : (
          <>
            {upNext && !(todayRoutine && doneToday) && (
              <div className="card" style={{ marginBottom: 12 }}>
                <div className="small accent bold">
                  {todayRoutine ? t('On the plan today · {day}', { day: t(DAY_NAMES[todayIdx]) }) : t('Up next')}
                </div>
                <h2 style={{ margin: '4px 0 6px' }}>{upNext.name}</h2>
                <div className="small muted ellipsis">{upNext.exercises.map((e) => exMap.get(e.exerciseId)?.name).join(', ')}</div>
                <button className="btn primary block mt" onClick={() => start(upNext.id)}>
                  {t('Start workout')}
                </button>
              </div>
            )}
            <div className="grid-2">
              <button className="card tap center" style={{ padding: 14 }} onClick={() => start()}>
                <div style={{ margin: '0 auto 8px', width: 42, height: 42, borderRadius: 14, background: 'var(--accent)', display: 'grid', placeItems: 'center', color: 'var(--on-accent)' }}>
                  <Plus size={22} strokeWidth={3} />
                </div>
                <div className="small bold">{t('Empty')}</div>
              </button>
              <button
                className="card tap center"
                style={{ padding: 14, opacity: last ? 1 : 0.5 }}
                disabled={!last}
                onClick={() => {
                  if (!last) return;
                  repeatWorkout(last.id);
                  navigate('/workout');
                }}
              >
                <div style={{ margin: '0 auto 8px', width: 42, height: 42, borderRadius: 14, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', color: 'var(--accent)' }}>
                  <RotateCcw size={21} />
                </div>
                <div className="small bold">{t('Repeat last')}</div>
              </button>
            </div>
          </>
        )}
      </div>

      {recentPRs.length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>{t('Recent PRs')}</h2>
          </div>
          <div className="list">
            {recentPRs.map((p, i) => (
              <Link key={i} to={`/exercises/${p.exerciseId}`} className="list-item">
                <div className="avatar" style={{ background: 'var(--grad-gold)', color: '#2a1400' }}>
                  <Trophy size={20} />
                </div>
                <div className="grow">
                  <div className="bold ellipsis">{exMap.get(p.exerciseId)?.name}</div>
                  <div className="small muted">{relativeDay(p.date)}</div>
                </div>
                <ChevronRight size={18} className="muted" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-title">
          <h2>{t('Recent workouts')}</h2>
          <Link to="/history">{t('History')}</Link>
        </div>
        {workouts.length ? (
          <div className="stack">
            {workouts.slice(0, 3).map((w) => (
              <WorkoutCard key={w.id} w={w} prCount={game.progress.perWorkout.get(w.id)?.prExercises.length} />
            ))}
          </div>
        ) : (
          <div className="card empty">
            <div className="bold" style={{ color: 'var(--text)' }}>
              {t('Your first workout is waiting')}
            </div>
            <div className="mt">
              <Link to="/settings" className="btn sm soft">
                {t('Import data from Strong')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
