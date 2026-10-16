import { useEffect, useState } from 'react';
import { bigConfetti, haptic } from '../lib/celebrate';
import { levelInfo } from '../lib/gamification';

/** Full-screen "workout complete" moment with XP count-up and level progress. */
export function Celebration({
  xp,
  totalXp,
  prs,
  achievements,
  onClose,
}: {
  xp: number;
  totalXp: number;
  prs: number;
  achievements: string[];
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
        <div className="big-emoji">{levelUp ? after.icon : prs ? '🏆' : '🎉'}</div>
        <h1 style={{ color: '#fff', marginTop: 14 }}>{levelUp ? 'Level up!' : 'Trénink dokončen!'}</h1>
        <div style={{ color: 'rgba(255,255,255,0.8)', marginTop: 6, fontWeight: 700 }}>
          {levelUp ? `Teď jsi Level ${after.level} · ${after.title}` : prs ? `${prs}× nový osobní rekord!` : 'Skvělá práce, takhle dál.'}
        </div>
        <div className="grad-text" style={{ fontSize: 56, fontWeight: 900, marginTop: 18 }}>
          +{shown} XP
        </div>
        <div className="card" style={{ marginTop: 18, textAlign: 'left' }}>
          <div className="row between small bold">
            <span>
              {after.icon} Level {levelUp && bar < 1 && bar !== after.progress ? before.level : after.level}
            </span>
            <span className="muted">
              {after.current} / {after.needed} XP
            </span>
          </div>
          <div className="xp-bar on-card" style={{ marginTop: 8 }}>
            <div style={{ width: `${bar * 100}%` }} />
          </div>
          {achievements.length > 0 && (
            <div className="small mt">
              <span className="bold">Nové odznaky:</span> {achievements.join(' ')}
            </div>
          )}
        </div>
        <button className="btn primary lg block" style={{ marginTop: 18 }} onClick={onClose}>
          Zobrazit shrnutí
        </button>
      </div>
    </div>
  );
}
