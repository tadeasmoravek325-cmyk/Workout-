import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Flame, Plus, Snowflake, Sparkles, Trophy, User } from 'lucide-react';
import { useExerciseMap, useStore } from '../store/store';
import { muscleRecovery, nextRoutine, startOfWeek, workoutVolume } from '../lib/calc';
import { fmtVolume, relativeDay } from '../lib/format';
import { LOCALE_TAG, t, tn } from '../i18n';
import { LeagueCard } from '../components/League';
import { BodyMap, RECOVERY_COLORS, recoveryColor } from '../components/BodyMap';
import { WorkoutCard } from '../components/WorkoutCard';
import { GeneratorSheet } from '../components/GeneratorSheet';
import { MUSCLE_LABELS } from '../data/exercises';
import { ACHIEVEMENTS, achievementProgressLabel, achievementStats } from '../lib/achievements';
import { Medal } from '../components/Medal';
import { useGame } from '../lib/useGame';
import { backupDue, saveBackupFile } from '../lib/backup';
import type { Muscle } from '../types';

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY = 86_400_000;


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
  const game = useGame();
  const [generator, setGenerator] = useState(false);

  const weekStart = startOfWeek(Date.now());
  const thisWeek = workouts.filter((w) => w.startedAt >= weekStart);
  const weekVolume = thisWeek.reduce((a, w) => a + workoutVolume(w, exMap), 0);

  const todayIdx = (new Date().getDay() + 6) % 7;
  const todayRoutine = routines.find((r) => r.id === schedule[todayIdx]);
  const doneToday = workouts.some((w) => new Date(w.startedAt).toDateString() === new Date().toDateString());
  const upNext = todayRoutine ?? nextRoutine(routines, workouts);

  const recovery = useMemo(() => muscleRecovery(workouts.slice(0, 30), exMap), [workouts, exMap]);
  const ready = (Object.entries(recovery) as [Muscle, number][]).filter(([, v]) => v >= 0.95).map(([m]) => m);
  const tired = (Object.entries(recovery) as [Muscle, number][]).filter(([, v]) => v < 0.6).map(([m]) => m);

  const recentPRs = useMemo(() => {
    const out: { date: number; exerciseId: string }[] = [];
    for (const w of workouts.slice(0, 10)) {
      for (const id of game.progress.perWorkout.get(w.id)?.prExercises ?? []) out.push({ date: w.startedAt, exerciseId: id });
    }
    return out.slice(0, 4);
  }, [workouts, game.progress]);

  const nextAchievement = useMemo(() => {
    const stats = achievementStats(workouts, exMap, measurements);
    return ACHIEVEMENTS.map((a) => ({ a, p: a.progress(stats) }))
      .filter((x) => x.p < 1)
      .sort((x, y) => y.p - x.p)[0];
  }, [workouts, exMap, measurements]);

  const hour = new Date().getHours();
  const greeting = hour < 10 ? t('Good morning') : hour < 18 ? t('Hey') : t('Good evening');
  const name = settings.name ? `, ${settings.name}` : '';
  const unit = settings.unit;

  const start = (routineId?: string) => {
    const r = routines.find((x) => x.id === routineId);
    startWorkout(r);
    navigate('/workout');
  };

  const questsDone = game.quests.filter((q) => q.done).length;

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
        <Link to="/profile" className="icon-btn" aria-label={t('Profile')}>
          <User size={19} />
        </Link>
      </div>

      {/* Level + streak */}
      <Link to="/profile" className="hero" style={{ display: 'block' }}>
        <div className="hero-stats">
          <div>
            <div className="label">{t('Level')}</div>
            <div className="num-xl accent">{game.level.level}</div>
            <div className="small bold">{game.level.title}</div>
          </div>
          <div>
            <div className="label">{t('Streak')}</div>
            <div className="num-xl">
              {game.streak.streak}
              <span className="unit">{tn(game.streak.streak, 'week', 'weeks')}</span>
            </div>
            <div className="small muted">
              {game.streak.freezes > 0 ? (
                <>
                  <Snowflake size={12} style={{ verticalAlign: '-1px' }} />{' '}
                  {tn(game.streak.freezes, '{n} streak freeze', '{n} streak freezes')}
                </>
              ) : (
                t('Hit your weekly goal')
              )}
            </div>
          </div>
        </div>
        <div className="xp-bar" style={{ marginTop: 16 }}>
          <div style={{ width: `${game.level.progress * 100}%` }} />
        </div>
        <div className="row between small muted" style={{ marginTop: 6 }}>
          <span className="tabular">
            {game.level.current.toLocaleString(LOCALE_TAG)} / {game.level.needed.toLocaleString(LOCALE_TAG)} XP
          </span>
          <span>{t('to level {level}', { level: game.level.level + 1 })}</span>
        </div>
      </Link>

      {/* Streak at risk */}
      {game.risk && !active && (
        <div className={`card mt streak-risk ${game.risk.level}`} role="status">
          <Flame size={26} aria-hidden="true" />
          <div className="grow">
            <div className="bold">
              {game.risk.level === 'warn'
                ? t('Your {n}-week streak is at risk', { n: game.streak.streak })
                : game.risk.level === 'freeze'
                  ? t('A streak freeze will save this week')
                  : t('Your {n}-week streak ends this week', { n: game.streak.streak })}
            </div>
            <div className="small">
              {game.risk.level === 'warn'
                ? tn(game.risk.daysLeft, '{workouts} to go and {n} day left.', '{workouts} to go and {n} days left.', {
                    workouts: tn(game.risk.needed, '{n} workout', '{n} workouts'),
                  })
                : game.risk.level === 'freeze'
                  ? t('Not enough days left for your goal. Train anyway: every workout still earns league XP.')
                  : t('Not enough days left for your goal. Train anyway to stay in your league.')}
            </div>
          </div>
          {game.risk.level === 'warn' && (
            <button className="btn sm" onClick={() => start(upNext?.id)}>
              {t('Train now')}
            </button>
          )}
        </div>
      )}

      {/* League */}
      <div className="mt">
        <LeagueCard league={game.league} />
      </div>

      {/* Week */}
      <div className="card mt">
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
      </div>

      {backupDue(workouts.length, settings.lastBackupAt, settings.backupSnoozeUntil) && (
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
              <button className="card tap center" style={{ padding: 14 }} onClick={() => setGenerator(true)}>
                <div style={{ margin: '0 auto 8px', width: 42, height: 42, borderRadius: 14, background: 'var(--accent-soft)', display: 'grid', placeItems: 'center', color: 'var(--accent)' }}>
                  <Sparkles size={21} />
                </div>
                <div className="small bold">{t('Generate')}</div>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Quests */}
      <div className="section">
        <div className="section-title">
          <h2>{t('Weekly quests')}</h2>
          <span className="small muted bold">
            {t('{done}/{total} done', { done: questsDone, total: game.quests.length })}
          </span>
        </div>
        <div className="list">
          {game.quests.map((q) => (
            <div key={q.id} className={`quest ${q.done ? 'done' : ''}`}>
              <div className="qi">
                <Icon name={q.done ? 'target' : q.icon} size={20} />
              </div>
              <div className="grow">
                <div className="row between">
                  <span className="qt bold small">{q.title}</span>
                  <span className="badge purple">+{q.xp} XP</span>
                </div>
                {q.target > 1 && (
                  <div className="row tiny muted" style={{ marginTop: 6 }}>
                    <div className="progress grow" style={{ height: 6 }}>
                      <div style={{ width: `${(q.value / q.target) * 100}%`, background: q.done ? 'var(--grad-ok)' : undefined }} />
                    </div>
                    <span className="bold">
                      {q.value}/{q.target}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {Object.keys(recovery).length > 0 && (
        <div className="section">
          <div className="section-title">
            <h2>{t('Muscle recovery')}</h2>
            <Link to="/stats">{t('Stats')}</Link>
          </div>
          <div className="card">
            <BodyMap color={(m) => recoveryColor(recovery[m])} value={(m) => 1 - (recovery[m] ?? 1)} height={240} onPick={(m) => navigate(`/muscles/${m}`)} />
            <div className="row small bold" style={{ justifyContent: 'center', gap: 14 }}>
              <span>
                <span style={{ color: RECOVERY_COLORS.tired }}>●</span> {t('tired')}
              </span>
              <span>
                <span style={{ color: RECOVERY_COLORS.recovering }}>●</span> {t('recovering')}
              </span>
              <span>
                <span style={{ color: RECOVERY_COLORS.ready }}>●</span> {t('ready')}
              </span>
            </div>
            {ready.length > 0 && (
              <div className="small mt">
                <span className="ok bold">{t('Ready:')}</span> {ready.map((m) => MUSCLE_LABELS[m]).join(', ')}
              </div>
            )}
            {tired.length > 0 && (
              <div className="small" style={{ marginTop: 4 }}>
                <span className="danger bold">{t('Still recovering:')}</span> {tired.map((m) => MUSCLE_LABELS[m]).join(', ')}
              </div>
            )}
            <button className="btn cool block mt" onClick={() => setGenerator(true)}>
              <Sparkles size={17} /> {t('Workout for fresh muscles')}
            </button>
          </div>
        </div>
      )}

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

      {nextAchievement && (
        <div className="section">
          <div className="section-title">
            <h2>{t('Next badge')}</h2>
            <Link to="/achievements">{t('See all')}</Link>
          </div>
          <Link to="/achievements" className="card tap medal-next-card">
            <Medal
              motif={nextAchievement.a.motif}
              metal={nextAchievement.a.metal}
              locked
              size={72}
              label={nextAchievement.a.title}
            />
            <div className="grow">
              <div className="bold">{nextAchievement.a.title}</div>
              <div className="small muted">{nextAchievement.a.description}</div>
              <div className="medal-bar">
                <div style={{ width: `${nextAchievement.p * 100}%` }} />
              </div>
              <div className="small bold accent">
                {achievementProgressLabel(nextAchievement.a, achievementStats(workouts, exMap, measurements))}
              </div>
            </div>
          </Link>
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
            {t('Every workout earns you XP, and PRs earn a bonus on top.')}
            <div className="mt">
              <Link to="/settings" className="btn sm soft">
                {t('Import data from Strong')}
              </Link>
            </div>
          </div>
        )}
      </div>

      {generator && <GeneratorSheet onClose={() => setGenerator(false)} />}
    </div>
  );
}
