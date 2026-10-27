import { useEffect, useRef } from 'react';
import { Timer } from 'lucide-react';
import { useStore } from '../store/store';
import { useLocation, useNavigate } from 'react-router-dom';
import { beep, notify, vibrate } from '../lib/feedback';
import { fmtClock } from '../lib/format';
import { useNow } from './ui';
import { t } from '../i18n';

export function RestTimerBar({ aboveNav }: { aboveNav: boolean }) {
  const rest = useStore((s) => s.rest);
  const settings = useStore((s) => s.settings);
  const adjust = useStore((s) => s.adjustRest);
  const stop = useStore((s) => s.stopRest);
  const now = useNow(250);
  const fired = useRef<number | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const left = rest ? (rest.endsAt - now) / 1000 : 0;

  useEffect(() => {
    if (!rest || left > 0 || fired.current === rest.endsAt) return;
    fired.current = rest.endsAt;
    // Only alert if we finished recently (not when reopening the app much later).
    if (now - rest.endsAt < 5000) {
      if (settings.sound) beep();
      if (settings.vibrate) vibrate();
      if (document.hidden) void notify(t('Rest is over'), t('Time for your next set.'));
    }
    stop();
  }, [rest, left, now, settings.sound, settings.vibrate, stop]);

  if (!rest || left <= 0) return null;
  const pct = Math.max(0, Math.min(1, left / rest.durationSec));
  return (
    <div
      className={`rest ${left <= 5 ? 'ending' : ''}`}
      onClick={() => pathname !== '/workout' && navigate('/workout')}
      style={aboveNav ? { bottom: 'calc(var(--nav-h) + var(--safe-b) + 8px)', cursor: 'pointer' } : undefined}
    >
      <div className="bar" style={{ width: `${pct * 100}%` }} />
      <div className="content">
        <Timer size={20} className="accent" />
        <span className="time">{fmtClock(left)}</span>
        <button className="btn sm" onClick={(e) => { e.stopPropagation(); adjust(-15); }}>
          −15
        </button>
        <button className="btn sm" onClick={(e) => { e.stopPropagation(); adjust(15); }}>
          +15
        </button>
        <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); stop(); }}>
          {t('Skip')}
        </button>
      </div>
    </div>
  );
}
