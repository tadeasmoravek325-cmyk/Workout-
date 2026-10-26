import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Dumbbell, Flame, Medal, Settings as Cog, Snowflake, Trophy, Weight } from 'lucide-react';
import { useExerciseMap, useStore } from '../store/store';
import { useGame } from '../lib/useGame';
import { RANKS } from '../lib/gamification';
import { Sheet } from '../components/ui';
import { ageFromBirthYear, STANDARDS_SOURCE, strengthRanks, TIERS } from '../lib/strength';
import { startOfDay, startOfWeek, workoutDurationMs, workoutVolume, setsPerMuscle } from '../lib/calc';
import { fmtDate, fmtNum, fmtVolume, toDisplayWeight } from '../lib/format';
import { LOCALE_TAG, t, tn } from '../i18n';
import { MUSCLE_LABELS } from '../data/exercises';
import { BodyMap, formColor } from '../components/BodyMap';
import { DivisionBadge, LeagueCard } from '../components/League';
import { ACHIEVEMENTS, achievementStats } from '../lib/achievements';
import { Medal as BadgeMedal } from '../components/Medal';
import type { Muscle } from '../types';

const DAY = 86_400_000;

export default function Profile() {
  const workouts = useStore((s) => s.workouts);
  const measurements = useStore((s) => s.measurements);
  const settings = useStore((s) => s.settings);
  const exMap = useExerciseMap();
  const navigate = useNavigate();
  const game = useGame();
  const [ranksOpen, setRanksOpen] = useState(false);
  const unit = settings.unit;
  const bodyweight = [...measurements].reverse().find((m) => m.type === 'bodyweight')?.value;
  const ranks = useMemo(
    () => strengthRanks(workouts, bodyweight, settings.sex, ageFromBirthYear(settings.birthYear)),
    [workouts, bodyweight, settings.sex, settings.birthYear],
  );

  const totalVolume = useMemo(() => workouts.reduce((a, w) => a + workoutVolume(w, exMap), 0), [workouts, exMap]);
  const totalHours = workouts.reduce((a, w) => a + workoutDurationMs(w), 0) / 3_600_000;

  // Activity heatmap: last 18 weeks, Monday-first columns.
  const heat = useMemo(() => {
    const weeks = 18;
    const start = startOfWeek(Date.now()) - (weeks - 1) * 7 * DAY;
    const perDay = new Map<number, number>();
    for (const w of workouts) {
      if (w.startedAt < start) continue;
      const d = startOfDay(w.startedAt);
      perDay.set(d, (perDay.get(d) ?? 0) + workoutVolume(w, exMap) + 1);
    }
    const max = Math.max(1, ...perDay.values());
    const cells: { ts: number; v: number; future: boolean }[] = [];
    for (let i = 0; i < weeks * 7; i++) {
      const ts = startOfDay(start + i * DAY + 12 * 3_600_000);
      cells.push({ ts, v: (perDay.get(ts) ?? 0) / max, future: ts > Date.now() });
    }
    return cells;
  }, [workouts, exMap]);

  const month = useMemo(() => {
    const now = new Date();
    const thisStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const cur = workouts.filter((w) => w.startedAt >= thisStart);
    const prev = workouts.filter((w) => w.startedAt >= prevStart && w.startedAt < thisStart);
    const vol = (ws: typeof workouts) => ws.reduce((a, w) => a + workoutVolume(w, exMap), 0);
    const muscles = setsPerMuscle(cur, exMap, thisStart);
    const top = (Object.entries(muscles) as [Muscle, number][]).sort((a, b) => b[1] - a[1])[0];
    const prs = cur.reduce((a, w) => a + (game.progress.perWorkout.get(w.id)?.prExercises.length ?? 0), 0);
    return { count: cur.length, prevCount: prev.length, volume: vol(cur), prevVolume: vol(prev), top, prs };
  }, [workouts, exMap, game.progress]);

  const achStats = useMemo(() => achievementStats(workouts, exMap, measurements), [workouts, exMap, measurements]);
  const unlocked = ACHIEVEMENTS.filter((a) => a.progress(achStats) >= 1);

  const heatColor = (v: number) =>
    v === 0 ? 'var(--card-2)' : `color-mix(in srgb, #ff7a1a ${Math.round(35 + v * 65)}%, var(--card-2))`;

  const diff = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> {t('Back')}
        </button>
        <Link to="/settings" className="icon-btn" aria-label={t('Settings')}>
          <Cog size={19} />
        </Link>
      </div>

      <div className="hero">
        <div className="row" style={{ gap: 14 }}>
          <div className="level-badge" style={{ width: 64, height: 64, fontSize: 32 }}>
            <Icon name={game.level.icon} size={30} />
            <span className="n">Lv {game.level.level}</span>
          </div>
          <div className="grow">
            <h1 style={{ fontSize: 26 }}>{settings.name || t('My profile')}</h1>
            <button type="button" className="rank-line" onClick={() => setRanksOpen(true)}>
              <span className="bold accent">{game.level.title}</span>
              <span className="small muted">
                {' · '}
                {t('rank {n} of {total}', { n: game.level.rank, total: RANKS.length })}
                {game.level.nextRank && ` · ${t('{title} at level {level}', { title: t(game.level.nextRank.title), level: game.level.nextRank.level })}`}
              </span>
            </button>
          </div>
        </div>
        <div className="row between small bold" style={{ marginTop: 16, marginBottom: 6 }}>
          <span>{game.totalXp.toLocaleString(LOCALE_TAG)} XP</span>
          <span className="muted">
            {t('{xp} XP to next level', { xp: (game.level.needed - game.level.current).toLocaleString(LOCALE_TAG) })}
          </span>
        </div>
        <div className="xp-bar">
          <div style={{ width: `${game.level.progress * 100}%` }} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <span className="badge white">
            <Flame size={13} /> {tn(game.streak.streak, '{n} week streak', '{n} week streak')}
          </span>
          <span className="badge white">
            <Snowflake size={13} /> {tn(game.streak.freezes, '{n} streak freeze', '{n} streak freezes')}
          </span>
          <span className="badge white">
            <Medal size={13} /> {tn(unlocked.length, '{n} badge', '{n} badges')}
          </span>
        </div>
      </div>

      <div className="mt">
        <LeagueCard league={game.league} />
        {game.league.history.length > 0 && (
          <div className="league-history">
            {game.league.history.slice(-8).map((h) => (
              <div key={h.week} className="col" title={t('{xp} XP', { xp: h.xp })}>
                <DivisionBadge division={h.to} size={26} muted={h.to < h.from} />
                <span className="tiny muted">{fmtDate(h.week, { day: 'numeric', month: 'numeric' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid-2 mt">
        {[
          { icon: <Dumbbell size={17} />, bg: 'var(--grad)', v: workouts.length, l: t('Workouts') },
          { icon: <Weight size={17} />, bg: 'var(--grad-cool)', v: fmtVolume(totalVolume, unit), l: t('Total lifted') },
          { icon: <Clock size={17} />, bg: 'var(--grad-ok)', v: `${fmtNum(totalHours, 0)} h`, l: t('In the gym') },
          { icon: <Trophy size={17} />, bg: 'var(--grad-gold)', v: game.progress.totalPrs, l: t('PRs') },
        ].map((s) => (
          <div key={s.l} className="stat">
            <div className="ico" style={{ background: s.bg }}>
              {s.icon}
            </div>
            <div className="v">{s.v}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-title">
          <h2>{t('Activity')}</h2>
          <span className="small muted">{t('last {n} weeks', { n: 18 })}</span>
        </div>
        <div className="card">
          <div className="heatmap">
            {heat.map((c) => (
              <div
                key={c.ts}
                title={new Date(c.ts).toLocaleDateString(LOCALE_TAG)}
                style={{ background: c.future ? 'transparent' : heatColor(c.v) }}
              />
            ))}
          </div>
          <div className="row tiny muted" style={{ justifyContent: 'flex-end', marginTop: 8, gap: 4 }}>
            {t('less')}
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <span key={v} style={{ width: 11, height: 11, borderRadius: 3, background: heatColor(v), display: 'inline-block' }} />
            ))}
            {t('more')}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>{t('{month} at a glance', { month: new Date().toLocaleDateString(LOCALE_TAG, { month: 'long' }).replace(/^./, (c) => c.toUpperCase()) })}</h2>
        </div>
        <div className="card">
          <div className="grid-2">
            <div>
              <div className="small muted bold">{t('Workouts')}</div>
              <div className="num-lg">
                {month.count}{' '}
                {diff(month.count, month.prevCount) !== null && (
                  <span className={`small ${month.count >= month.prevCount ? 'ok' : 'danger'}`}>
                    {month.count >= month.prevCount ? '▲' : '▼'} {Math.abs(diff(month.count, month.prevCount)!)} %
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="small muted bold">{t('Volume')}</div>
              <div className="num-lg">
                {fmtVolume(month.volume, unit)}{' '}
                {diff(month.volume, month.prevVolume) !== null && (
                  <span className={`small ${month.volume >= month.prevVolume ? 'ok' : 'danger'}`}>
                    {month.volume >= month.prevVolume ? '▲' : '▼'} {Math.abs(diff(month.volume, month.prevVolume)!)} %
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="small muted bold">{t('PRs')}</div>
              <div className="num-lg">{month.prs}</div>
            </div>
            <div>
              <div className="small muted bold">{t('Most trained')}</div>
              <div className="num-lg" style={{ fontSize: 22 }}>{month.top ? MUSCLE_LABELS[month.top[0]] : '–'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>{t('Muscle form')}</h2>
          <span className="small muted">{t('Fades after ~2 weeks off')}</span>
        </div>
        <div className="card">
          <BodyMap
            height={240}
            value={(m) => game.muscles[m].form}
            color={(m) => formColor(game.muscles[m].level, game.muscles[m].form)}
            onPick={(m) => navigate(`/muscles/${m}`)}
          />
          <div className="muscle-levels mt">
            {(Object.keys(game.muscles) as Muscle[])
              .sort((a, b) => game.muscles[b].lifetime - game.muscles[a].lifetime)
              .map((m) => {
                const f = game.muscles[m];
                return (
                  <Link key={m} to={`/muscles/${m}`} className="muscle-level">
                    <span className="lv">{f.level}</span>
                    <span className="grow ellipsis small bold">{MUSCLE_LABELS[m]}</span>
                    <span className="form-dot" style={{ background: formColor(f.level, f.form) }} />
                  </Link>
                );
              })}
          </div>
          <div className="tiny muted mt">
            {t('Levels grow with every set and never drop. Form shows what you trained lately and fades when a muscle rests too long.')}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>{t('Strength ranks')}</h2>
          <span className="small muted">{t('relative to bodyweight')}</span>
        </div>
        {!bodyweight ? (
          <div className="card small">
            {t('Log your bodyweight in')}{' '}
            <Link to="/measure" className="accent bold">
              {t('Measurements')}
            </Link>{' '}
            {t('to see if you are Bronze or already Diamond.')}
          </div>
        ) : !ranks.length ? (
          <div className="card small muted">{t('Do a bench press, squat, deadlift, overhead press, barbell row or pull-ups to earn a rank.')}</div>
        ) : (
          <div className="list">
            {ranks.map((r) => (
              <Link key={r.exerciseId} to={`/exercises/${r.exerciseId}`} className="list-item" style={{ display: 'block' }}>
                <div className="row between">
                  <span className="bold">{t(r.label)}</span>
                  <span className="tier-chip" style={{ background: `${r.tier.color}26`, color: r.tier.color }}>
                    <Icon name={r.tier.icon} size={13} /> {t(r.tier.name)}
                    {r.level && <span style={{ opacity: 0.75 }}> · {t(r.level)}</span>}
                  </span>
                </div>
                <div className="row small muted" style={{ marginTop: 6 }}>
                  <span>
                    {r.byReps ? tn(r.value, '{n} rep', '{n} reps') : `1RM ${fmtNum(toDisplayWeight(r.value, unit))} ${unit}`}
                  </span>
                  <div className="progress grow" style={{ height: 6 }}>
                    <div style={{ width: `${r.progress * 100}%`, background: r.next?.color ?? r.tier.color }} />
                  </div>
                  {r.next && r.nextTarget !== undefined && (
                    <span>
                      <Icon name={r.next.icon} size={12} style={{ color: r.next.color }} /> {r.byReps ? `${r.nextTarget}` : fmtNum(toDisplayWeight(r.nextTarget, unit), 0)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="row tiny muted mt" style={{ gap: 8, flexWrap: 'wrap' }}>
          {TIERS.slice(1).map((tier) => (
            <span key={tier.id}>
              <Icon name={tier.icon} size={12} style={{ color: tier.color, verticalAlign: '-2px' }} /> {t(tier.name)}
            </span>
          ))}
        </div>
        <div className="tiny muted mt">
          {t(STANDARDS_SOURCE)}
          {!settings.sex && ` ${t('Set your gender in Settings for the right standards.')}`}
          {!settings.birthYear && ` ${t('Add your birth year in Settings to adjust for age.')}`}
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>{t('Badges')}</h2>
          <Link to="/achievements">{t('See all')}</Link>
        </div>
        <div className="card">
          {unlocked.length ? (
            <>
              <div className="medal-shelf">
                {unlocked
                  .filter((a) => !unlocked.some((b) => b.familyId === a.familyId && b.tier > a.tier))
                  .map((a) => (
                    <Link key={a.id} to="/achievements" title={a.title} aria-label={a.title}>
                      <BadgeMedal motif={a.motif} metal={a.metal} size={58} />
                    </Link>
                  ))}
              </div>
              <div className="small muted center mt">
                {t('{unlocked} of {total} medals earned', { unlocked: unlocked.length, total: ACHIEVEMENTS.length })}
              </div>
            </>
          ) : (
            <span className="small muted">{t('None yet. Your first one comes with your first workout.')}</span>
          )}
        </div>
      </div>
      {ranksOpen && (
        <Sheet title={t('Ranks')} onClose={() => setRanksOpen(false)}>
          <p className="small muted" style={{ marginTop: 0 }}>
            {t('Your rank grows with your level and never drops. Every workout, set, PR and quest earns XP.')}
          </p>
          <div className="list">
            {RANKS.map((r, i) => {
              const reached = game.level.level >= r.level;
              const here = game.level.rank === i + 1;
              return (
                <div key={r.title} className={`list-item ladder-row ${here ? 'here' : ''}`}>
                  <span className={`rank-icon ${reached ? 'on' : ''}`}>
                    <Icon name={r.icon} size={18} />
                  </span>
                  <div className="grow">
                    <div className="bold">
                      {t(r.title)} {here && <span className="badge accent">{t('You')}</span>}
                    </div>
                    <div className="small muted">{t(r.meaning)}</div>
                  </div>
                  <span className="small bold muted">{t('Level {n}', { n: r.level })}</span>
                </div>
              );
            })}
          </div>
        </Sheet>
      )}
    </div>
  );
}
