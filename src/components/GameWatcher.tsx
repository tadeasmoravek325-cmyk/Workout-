import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../store/store';
import { useGame } from '../lib/useGame';
import { startOfWeek } from '../lib/calc';
import { DIVISIONS, type LeagueWeek } from '../lib/gamification';
import { smallConfetti, bigConfetti, haptic } from '../lib/celebrate';
import { fmtDate } from '../lib/format';
import { DivisionBadge } from './League';
import { Sheet, toast } from './ui';
import { t } from '../i18n';

/**
 * Turns progress into moments: a quest completing gets its own toast and confetti,
 * and the first visit after a league week ends shows the result.
 * Bulk changes (imports, restores) never trigger anything.
 */
export function GameWatcher() {
  const game = useGame();
  const workouts = useStore((s) => s.workouts.length);
  const seenWeek = useStore((s) => s.settings.leagueSeenWeek);
  const updateSettings = useStore((s) => s.updateSettings);
  const { pathname } = useLocation();
  const prev = useRef<{ done: Set<string>; count: number; week: number } | null>(null);
  const [result, setResult] = useState<LeagueWeek | null>(null);

  useEffect(() => {
    const done = new Set(game.quests.filter((q) => q.done).map((q) => q.id));
    const week = startOfWeek(Date.now());
    const p = prev.current;
    prev.current = { done, count: workouts, week };
    if (!p || p.week !== week || Math.abs(workouts - p.count) > 1) return;
    const fresh = game.quests.filter((q) => q.done && !p.done.has(q.id));
    fresh.forEach((q, i) =>
      setTimeout(
        () => {
          toast(t('Quest complete · {title} · +{xp} XP', { title: q.title, xp: q.xp }), 'pr', 4000);
          smallConfetti(0.15);
          haptic([20, 40, 20]);
        },
        // Let the workout celebration land first.
        1800 + i * 1500,
      ),
    );
  }, [game.quests, workouts]);

  const last = game.league.history[game.league.history.length - 1];
  useEffect(() => {
    if (!last || pathname === '/workout' || result) return;
    if (seenWeek === undefined || seenWeek < last.week) {
      // Nothing to celebrate for someone who never had a league week before (fresh import).
      if (seenWeek === undefined && game.league.history.length > 1) {
        updateSettings({ leagueSeenWeek: last.week });
        return;
      }
      setResult(last);
      if (last.to > last.from) bigConfetti();
    }
  }, [last, seenWeek, pathname, result, game.league.history.length, updateSettings]);

  if (!result) return null;
  const close = () => {
    updateSettings({ leagueSeenWeek: result.week });
    setResult(null);
  };
  const up = result.to > result.from;
  const down = result.to < result.from;
  const name = t(DIVISIONS[result.to].name);
  return (
    <Sheet title={t('League week ended')} onClose={close}>
      <div className="center">
        <div className="small muted">{t('Week of {date}', { date: fmtDate(result.week, { day: 'numeric', month: 'long' }) })}</div>
        <div style={{ margin: '14px auto 6px', width: 'fit-content' }}>
          <DivisionBadge division={result.to} size={84} />
        </div>
        <h2 style={{ color: DIVISIONS[result.to].color }}>
          {up ? t('Promoted to {name}!', { name }) : down ? t('Dropped to {name}', { name }) : t('You stay in {name}', { name })}
        </h2>
        <p className="muted">
          {up
            ? t('You earned {xp} XP last week. New week, higher bar.', { xp: result.xp })
            : down
              ? t('Only {xp} XP last week. Hit your weekly goal to climb back.', { xp: result.xp })
              : t('{xp} XP last week. A little more and you move up.', { xp: result.xp })}
        </p>
        <button className="btn primary block mt" onClick={close}>
          {up ? t("Let's keep it going") : t("Let's go")}
        </button>
      </div>
    </Sheet>
  );
}
