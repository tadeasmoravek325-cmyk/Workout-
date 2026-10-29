import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { ChevronDown, Delete as Backspace, Minus, Plus, Scale } from 'lucide-react';
import { fmtNum } from '../lib/format';
import { t } from '../i18n';

export type KeypadKind = 'weight' | 'reps' | 'distance';

/** What the keypad is currently typing into. Registered by the focused input. */
export interface KeypadTarget {
  kind: KeypadKind;
  el: HTMLInputElement;
  /** Replaces the text of the input. */
  setText: (text: string) => void;
  text: () => string;
  placeholder: () => string;
  /** Size of one + or − step in the input's own unit. */
  step: number;
  /** Optional per-set extras: RPE picker (reps field) and plate calculator (weight field). */
  rpe?: number;
  onRpe?: (v: number | undefined) => void;
  onPlates?: () => void;
}

interface KeypadState {
  active: KeypadTarget | null;
  /** The next typed digit replaces the value (it arrives selected). */
  replace: boolean;
  rpeOpen: boolean;
  open: (t: KeypadTarget) => void;
  close: () => void;
}

export const useKeypad = create<KeypadState>((set) => ({
  active: null,
  replace: true,
  rpeOpen: false,
  open: (active) => set({ active, replace: true, rpeOpen: false }),
  close: () => set({ active: null, rpeOpen: false }),
}));

const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

function toNumber(text: string): number {
  const n = Number(text.replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
}

/** Moves to the next set input in the page, or closes the keypad after the last one. */
function goNext(from: HTMLInputElement) {
  const all = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-keypad]'));
  const next = all[all.indexOf(from) + 1];
  if (next) {
    next.focus();
    next.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } else {
    from.blur();
    useKeypad.getState().close();
  }
}

/**
 * Number pad docked to the bottom while a set field is focused. Reps get an RPE button, weight gets the
 * plate calculator, and Next walks through the fields set by set. The system keyboard stays hidden.
 */
export function Keypad() {
  const { active, rpeOpen } = useKeypad();
  const box = useRef<HTMLDivElement>(null);

  // Keep the page scrollable past the pad so the focused field is never hidden behind it.
  useEffect(() => {
    const root = document.documentElement;
    if (!active) {
      root.classList.remove('has-keypad');
      return;
    }
    root.classList.add('has-keypad');
    root.style.setProperty('--keypad-h', `${box.current?.offsetHeight ?? 300}px`);
    return () => root.classList.remove('has-keypad');
  }, [active]);

  if (!active) return null;
  const st = useKeypad.getState();
  const noFocusLoss = {
    onPointerDown: (e: React.PointerEvent) => e.preventDefault(),
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
  };

  const type = (key: string) => {
    const cur = useKeypad.getState().replace ? '' : active.text();
    let next = cur;
    if (key === 'back') next = useKeypad.getState().replace ? '' : cur.slice(0, -1);
    else if (key === ',') {
      if (active.kind === 'reps') return;
      if (cur.includes(',')) return;
      next = (cur || '0') + ',';
    } else {
      const max = active.kind === 'reps' ? 3 : 7;
      if (cur.replace(',', '').length >= max) return;
      next = cur === '0' ? key : cur + key;
    }
    useKeypad.setState({ replace: false });
    active.setText(next);
  };

  const step = (dir: 1 | -1) => {
    const base = active.text() !== '' ? toNumber(active.text()) : toNumber(active.placeholder());
    const next = Math.max(0, Math.round((base + dir * active.step) * 100) / 100);
    useKeypad.setState({ replace: true });
    active.setText(String(next).replace('.', ','));
    // Keep the selection visible so another digit starts fresh.
    active.el.select();
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const showRpe = active.kind === 'reps' && !!active.onRpe;
  const showPlates = active.kind === 'weight' && !!active.onPlates;

  return (
    <div ref={box} className="keypad" role="group" aria-label={t('Number pad')} {...noFocusLoss}>
      {rpeOpen ? (
        <div className="keypad-rpe">
          <div className="small muted bold">{t('How hard was it? (RPE)')}</div>
          <div className="keypad-rpe-grid">
            {RPE_VALUES.map((v) => (
              <button
                key={v}
                className={`kp ${active.rpe === v ? 'on' : ''}`}
                onClick={() => {
                  active.onRpe?.(active.rpe === v ? undefined : v);
                  useKeypad.setState({ rpeOpen: false });
                }}
              >
                {fmtNum(v, 1)}
              </button>
            ))}
          </div>
          <button className="kp wide" onClick={() => useKeypad.setState({ rpeOpen: false })}>
            {t('Back')}
          </button>
        </div>
      ) : (
        <>
          <div className="keypad-digits">
            {keys.map((k) => (
              <button key={k} className="kp digit" onClick={() => type(k)}>
                {k}
              </button>
            ))}
            <button className="kp digit" onClick={() => type(',')} disabled={active.kind === 'reps'} aria-label={t('Decimal comma')}>
              {active.kind === 'reps' ? '' : ','}
            </button>
            <button className="kp digit" onClick={() => type('0')}>
              0
            </button>
            <button className="kp digit" onClick={() => type('back')} aria-label={t('Delete')}>
              <Backspace size={26} />
            </button>
          </div>
          <div className="keypad-side">
            <button
              className="kp"
              onClick={() => {
                active.el.blur();
                st.close();
              }}
              aria-label={t('Hide keypad')}
            >
              <ChevronDown size={26} />
            </button>
            {showRpe ? (
              <button className="kp" onClick={() => useKeypad.setState({ rpeOpen: true })}>
                {active.rpe ? `RPE ${fmtNum(active.rpe, 1)}` : 'RPE'}
              </button>
            ) : showPlates ? (
              <button
                className="kp"
                onClick={() => {
                  active.onPlates?.();
                  active.el.blur();
                  st.close();
                }}
                aria-label={t('Plate calculator')}
              >
                <Scale size={24} />
              </button>
            ) : (
              <span />
            )}
            <div className="kp-pair">
              <button className="kp" onClick={() => step(-1)} aria-label={t('Less')}>
                <Minus size={24} />
              </button>
              <button className="kp" onClick={() => step(1)} aria-label={t('More')}>
                <Plus size={24} />
              </button>
            </div>
            <button className="kp next" onClick={() => goNext(active.el)}>
              {t('Next')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
