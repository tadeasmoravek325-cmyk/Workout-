import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Dumbbell, Flame, Settings as Cog, Snowflake, Trophy, Weight } from 'lucide-react';
import { useExerciseMap, useStore } from '../store/store';
import { useGame } from '../lib/useGame';
import { strengthRanks, TIERS } from '../lib/strength';
import { startOfDay, startOfWeek, workoutDurationMs, workoutVolume, setsPerMuscle } from '../lib/calc';
import { fmtNum, fmtVolume, plural, toDisplayWeight } from '../lib/format';
import { MUSCLE_LABELS } from '../data/exercises';
import { ACHIEVEMENTS, achievementStats } from '../lib/achievements';
import type { Muscle } from '../types';

const DAY = 86_400_000;

export default function Profile() {
  const workouts = useStore((s) => s.workouts);
  const measurements = useStore((s) => s.measurements);
  const settings = useStore((s) => s.settings);
  const exMap = useExerciseMap();
  const navigate = useNavigate();
  const game = useGame();
  const unit = settings.unit;
  const bodyweight = [...measurements].reverse().find((m) => m.type === 'bodyweight')?.value;
  const ranks = useMemo(() => strengthRanks(workouts, bodyweight, settings.sex), [workouts, bodyweight, settings.sex]);

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
    v === 0 ? 'var(--card-2)' : `color-mix(in srgb, #ff5a6e ${Math.round(35 + v * 65)}%, var(--card-2))`;

  const diff = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Zpět
        </button>
        <Link to="/settings" className="icon-btn" aria-label="Nastavení">
          <Cog size={19} />
        </Link>
      </div>

      <div className="hero">
        <div className="row" style={{ gap: 14 }}>
          <div className="level-badge" style={{ width: 64, height: 64, fontSize: 32 }}>
            {game.level.icon}
            <span className="n">Lv {game.level.level}</span>
          </div>
          <div className="grow">
            <h1 style={{ fontSize: 26 }}>{settings.name || 'Setsmith'}</h1>
            <div className="bold" style={{ opacity: 0.9 }}>
              {game.level.title}
            </div>
          </div>
        </div>
        <div className="row between small bold" style={{ marginTop: 16, marginBottom: 6 }}>
          <span>{game.totalXp.toLocaleString('cs-CZ')} XP</span>
          <span className="muted">
            další level za {(game.level.needed - game.level.current).toLocaleString('cs-CZ')} XP
          </span>
        </div>
        <div className="xp-bar">
          <div style={{ width: `${game.level.progress * 100}%` }} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <span className="badge white">
            <Flame size={13} /> {game.streak.streak} {plural(game.streak.streak, ['týden', 'týdny', 'týdnů'])} v řadě
          </span>
          <span className="badge white">
            <Snowflake size={13} /> {game.streak.freezes} {plural(game.streak.freezes, ['ochrana', 'ochrany', 'ochran'])}
          </span>
          <span className="badge white">🏅 {unlocked.length} odznaků</span>
        </div>
      </div>

      <div className="grid-2 mt">
        {[
          { icon: <Dumbbell size={17} />, bg: 'var(--grad)', v: workouts.length, l: 'Tréninků' },
          { icon: <Weight size={17} />, bg: 'var(--grad-cool)', v: fmtVolume(totalVolume, unit), l: 'Zvednuto celkem' },
          { icon: <Clock size={17} />, bg: 'var(--grad-ok)', v: `${fmtNum(totalHours, 0)} h`, l: 'V posilovně' },
          { icon: <Trophy size={17} />, bg: 'var(--grad-gold)', v: game.progress.totalPrs, l: 'Osobních rekordů' },
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
          <h2>Aktivita</h2>
          <span className="small muted">posledních 18 týdnů</span>
        </div>
        <div className="card">
          <div className="heatmap">
            {heat.map((c) => (
              <div
                key={c.ts}
                title={new Date(c.ts).toLocaleDateString('cs-CZ')}
                style={{ background: c.future ? 'transparent' : heatColor(c.v) }}
              />
            ))}
          </div>
          <div className="row tiny muted" style={{ justifyContent: 'flex-end', marginTop: 8, gap: 4 }}>
            méně
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <span key={v} style={{ width: 11, height: 11, borderRadius: 3, background: heatColor(v), display: 'inline-block' }} />
            ))}
            více
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>{new Date().toLocaleDateString('cs-CZ', { month: 'long' }).replace(/^./, (c) => c.toUpperCase())} v kostce</h2>
        </div>
        <div className="card">
          <div className="grid-2">
            <div>
              <div className="small muted bold">Tréninky</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>
                {month.count}{' '}
                {diff(month.count, month.prevCount) !== null && (
                  <span className={`small ${month.count >= month.prevCount ? 'ok' : 'danger'}`}>
                    {month.count >= month.prevCount ? '▲' : '▼'} {Math.abs(diff(month.count, month.prevCount)!)} %
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="small muted bold">Objem</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>
                {fmtVolume(month.volume, unit)}{' '}
                {diff(month.volume, month.prevVolume) !== null && (
                  <span className={`small ${month.volume >= month.prevVolume ? 'ok' : 'danger'}`}>
                    {month.volume >= month.prevVolume ? '▲' : '▼'} {Math.abs(diff(month.volume, month.prevVolume)!)} %
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="small muted bold">Rekordy</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>🏆 {month.prs}</div>
            </div>
            <div>
              <div className="small muted bold">Nejvíc trénováno</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{month.top ? MUSCLE_LABELS[month.top[0]] : '–'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>Silové ranky</h2>
          <span className="small muted">vůči tělesné hmotnosti</span>
        </div>
        {!bodyweight ? (
          <div className="card small">
            Zapiš si tělesnou hmotnost v{' '}
            <Link to="/measure" className="accent bold">
              Měření
            </Link>{' '}
            a uvidíš, jestli jsi Bronz, nebo už Diamant. 💎
          </div>
        ) : !ranks.length ? (
          <div className="card small muted">Odcvič bench press, dřep, mrtvý tah, tlak nad hlavu, přítahy nebo shyby a získáš rank.</div>
        ) : (
          <div className="list">
            {ranks.map((r) => (
              <Link key={r.exerciseId} to={`/exercises/${r.exerciseId}`} className="list-item" style={{ display: 'block' }}>
                <div className="row between">
                  <span className="bold">{r.label}</span>
                  <span className="tier-chip" style={{ background: `${r.tier.color}26`, color: r.tier.color }}>
                    {r.tier.icon} {r.tier.name}
                  </span>
                </div>
                <div className="row small muted" style={{ marginTop: 6 }}>
                  <span>
                    {r.byReps ? `${r.value} opak.` : `1RM ${fmtNum(toDisplayWeight(r.value, unit))} ${unit}`}
                  </span>
                  <div className="progress grow" style={{ height: 6 }}>
                    <div style={{ width: `${r.progress * 100}%`, background: r.next?.color ?? r.tier.color }} />
                  </div>
                  {r.next && r.nextTarget !== undefined && (
                    <span>
                      {r.next.icon} {r.byReps ? `${r.nextTarget}` : fmtNum(toDisplayWeight(r.nextTarget, unit), 0)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="row tiny muted mt" style={{ gap: 8, flexWrap: 'wrap' }}>
          {TIERS.slice(1).map((t) => (
            <span key={t.id}>
              {t.icon} {t.name}
            </span>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-title">
          <h2>Odznaky</h2>
          <Link to="/achievements">Všechny</Link>
        </div>
        <div className="card row" style={{ flexWrap: 'wrap', gap: 10 }}>
          {unlocked.length ? (
            unlocked.map((a) => (
              <span key={a.id} title={a.title} style={{ fontSize: 30 }}>
                {a.icon}
              </span>
            ))
          ) : (
            <span className="small muted">Zatím žádné. První dostaneš za první trénink!</span>
          )}
        </div>
      </div>
    </div>
  );
}
