import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { bigConfetti, haptic } from '../lib/celebrate';
import { DIVISIONS, levelInfo, type LeagueInfo } from '../lib/gamification';
import { leagueStatus } from './League';
import { t as tr, tn } from '../i18n';

/** Full-screen "workout complete" moment with XP count-up and level progress. */
export function Celebration({
  xp,
  totalXp,
  prs,
  achievements,
  lines = [],
  league,
  onClose,
}: {
  xp: number;
  totalXp: number;
  prs: number;
  achievements: string[];
  /** Where the XP came from. */
  lines?: { label: string; xp: number }[];
  league?: LeagueInfo;
  onClose: () => void;
}) {
  const before = levelInfo(Math.max(0, totalXp - xp));
  const after = levelInfo(totalXp);
  const levelUp = after.level > before.level;
  const [shown, setShown] = useState(0);
  const [bar, setBar] = useState(before.progress);

  useEffect(() => {
    bigConfetti();
    haptic([40, 60, 40, 60, 80]);
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1100);
      setShown(Math.round(xp * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const id = setTimeout(() => setBar(levelUp ? 1 : after.progress), 350);
    const id2 = levelUp
      ? setTimeout(() => {
          setBar(0);
          setTimeout(() => setBar(after.progress), 60);
          bigConfetti();
        }, 1300)
      : 0;
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(id);
      if (id2) clearTimeout(id2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="celebrate" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <div className="big-emoji">
          <Icon name={levelUp ? after.icon : prs ? 'trophy' : 'flag'} size={44} />
        </div>
        <h1 style={{ color: '#f5f5f5', marginTop: 16 }}>{levelUp ? tr('Level up!') : tr('Workout complete!')}</h1>
        <div style={{ color: '#bdbdbd', marginTop: 6, fontWeight: 600 }}>
          {levelUp
            ? tr("You're now level {level} · {title}", { level: after.level, title: after.title })
            : prs
              ? tn(prs, '{n} new personal record!', '{n} new personal records!')
              : tr('Great work. Keep it up.')}
        </div>
        <div className="num-xl accent" style={{ fontSize: 64, marginTop: 18 }}>
          +{shown} XP
        </div>
        {lines.length > 0 && (
          <div className="xp-lines">
            {lines.map((l) => (
              <div key={l.label} className="row between small">
                <span>{l.label}</span>
                <span className="bold accent">+{l.xp}</span>
              </div>
            ))}
          </div>
        )}
        <div className="card" style={{ marginTop: 18, textAlign: 'left' }}>
          <div className="row between small bold">
            <span>
              <Icon name={after.icon} size={15} style={{ verticalAlign: '-2px' }} /> {tr('Level')} {levelUp && bar < 1 && bar !== after.progress ? before.level : after.level}
            </span>
            <span className="muted">
              {after.current} / {after.needed} XP
            </span>
          </div>
          <div className="xp-bar on-card" style={{ marginTop: 8 }}>
            <div style={{ width: `${bar * 100}%` }} />
          </div>
          {league && (
            <div className="small mt">
              <span className="bold" style={{ color: DIVISIONS[league.division].color }}>
                {tr('{name} league', { name: tr(DIVISIONS[league.division].name) })}
              </span>{' '}
              · <span className="muted">{leagueStatus(league).text}</span>
            </div>
          )}
          {achievements.length > 0 && (
            <div className="small mt">
              <span className="bold">{tr('New badges:')}</span> {achievements.join(', ')}
            </div>
          )}
        </div>
        <button className="btn primary lg block" style={{ marginTop: 18 }} onClick={onClose}>
          {tr('View summary')}
        </button>
      </div>
    </div>
  );
}
