import { useEffect, useRef } from 'react';
import { Timer } from 'lucide-react';
import { useStore } from '../store/store';
import { beep, vibrate } from '../lib/feedback';
import { fmtClock } from '../lib/format';
import { useNow } from './ui';

export function RestTimerBar({ aboveNav }: { aboveNav: boolean }) {
  const rest = useStore((s) => s.rest);
  const settings = useStore((s) => s.settings);
  const adjust = useStore((s) => s.adjustRest);
  const stop = useStore((s) => s.stopRest);
  const now = useNow(250);
  const fired = useRef<number | null>(null);

  const left = rest ? (rest.endsAt - now) / 1000 : 0;

  useEffect(() => {
    if (!rest || left > 0 || fired.current === rest.endsAt) return;
    fired.current = rest.endsAt;
    // Only alert if we finished recently (not when reopening the app much later).
    if (now - rest.endsAt < 5000) {
      if (settings.sound) beep();
      if (settings.vibrate) vibrate();
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Pauza skončila', { body: 'Čas na další sérii.', tag: 'rest' });
        } catch {
          /* ignore */
        }
      }
    }
    stop();
  }, [rest, left, now, settings.sound, settings.vibrate, stop]);

  if (!rest || left <= 0) return null;
  const pct = Math.max(0, Math.min(1, left / rest.durationSec));
  return (
    <div className={`rest ${left <= 5 ? 'ending' : ''}`} style={aboveNav ? { bottom: 'calc(var(--nav-h) + var(--safe-b) + 8px)' } : undefined}>
      <div className="bar" style={{ width: `${pct * 100}%` }} />
      <div className="content">
        <Timer size={20} className="accent" />
        <span className="time">{fmtClock(left)}</span>
        <button className="btn sm" onClick={() => adjust(-15)}>
          −15
        </button>
        <button className="btn sm" onClick={() => adjust(15)}>
          +15
        </button>
        <button className="btn sm primary" onClick={stop}>
          Přeskočit
        </button>
      </div>
    </div>
  );
}
