import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { create } from 'zustand';

export function Sheet({
  title,
  onClose,
  children,
  full,
  action,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  full?: boolean;
  action?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`sheet ${full ? 'full' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-head">
          <button className="icon-btn" onClick={onClose} aria-label="Zavřít">
            <X size={18} />
          </button>
          <h2 className="grow center ellipsis">{title}</h2>
          <div style={{ minWidth: 44, display: 'flex', justifyContent: 'flex-end' }}>{action}</div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={label} />;
}

/** Numeric input that keeps the raw text while typing (so "2," or "" work) and accepts a decimal comma. */
export function NumInput({
  value,
  onChange,
  placeholder,
  step = 'any',
  className,
  style,
  ariaLabel,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  step?: string;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  const fmt = (v: number | undefined) => (v === undefined ? '' : String(Math.round(v * 100) / 100).replace('.', ','));
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused]);
  return (
    <input
      inputMode="decimal"
      data-step={step}
      className={className}
      style={style}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        e.target.select();
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,-]/g, '');
        setText(t);
        const n = Number(t.replace(',', '.'));
        onChange(t === '' || Number.isNaN(n) ? undefined : n);
      }}
    />
  );
}

export function Ring({
  value,
  size = 96,
  stroke = 9,
  color = 'var(--accent)',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--card-2)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="label">{children}</div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="big">{icon}</div>}
      <div className="bold" style={{ color: 'var(--text)', marginBottom: 6 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

/* ---------- toasts ---------- */

interface Toast {
  id: number;
  text: ReactNode;
  kind?: 'pr' | 'info' | 'error';
  action?: { label: string; run: () => void };
}

const useToasts = create<{ items: Toast[] }>(() => ({ items: [] }));
let toastId = 0;

function dismiss(id: number) {
  useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) }));
}

export function toast(text: ReactNode, kind: Toast['kind'] = 'info', ms = 2600, action?: Toast['action']) {
  const id = ++toastId;
  useToasts.setState((s) => ({ items: [...s.items.slice(-2), { id, text, kind, action }] }));
  setTimeout(() => dismiss(id), ms);
}

/** Toast with an "Undo" button, shown long enough to react. */
export function undoToast(text: ReactNode, undo: () => void) {
  toast(text, 'info', 6000, { label: 'Vrátit', run: undo });
}

export function Toasts() {
  const items = useToasts((s) => s.items);
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind ?? ''} ${t.action ? 'has-action' : ''}`}>
          <span className="grow">{t.text}</span>
          {t.action && (
            <button
              className="toast-action"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- in-app dialogs (native confirm() is unavailable in some embeds) ---------- */

interface DialogAction<T> {
  label: string;
  value: T;
  kind?: 'primary' | 'danger' | 'plain';
}

interface DialogState {
  title: string;
  message?: ReactNode;
  actions: DialogAction<unknown>[];
  resolve: (v: unknown) => void;
}

const useDialog = create<{ current: DialogState | null }>(() => ({ current: null }));

/** Shows a dialog with custom actions; resolves with the chosen value or null when dismissed. */
export function ask<T>(title: string, message: ReactNode, actions: DialogAction<T>[]): Promise<T | null> {
  return new Promise((resolve) => {
    useDialog.setState({
      current: { title, message, actions: actions as DialogAction<unknown>[], resolve: resolve as (v: unknown) => void },
    });
  });
}

/** Yes/no confirmation. */
export async function confirmDialog(title: string, message?: ReactNode, confirmLabel = 'Potvrdit', danger = true): Promise<boolean> {
  const r = await ask(title, message, [
    { label: 'Zpět', value: false, kind: 'plain' },
    { label: confirmLabel, value: true, kind: danger ? 'danger' : 'primary' },
  ]);
  return r === true;
}

export function Dialogs() {
  const current = useDialog((s) => s.current);
  if (!current) return null;
  const close = (v: unknown) => {
    useDialog.setState({ current: null });
    current.resolve(v);
  };
  return (
    <div className="overlay" onClick={() => close(null)} style={{ zIndex: 250 }}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className="sheet-body" style={{ paddingTop: 26 }}>
          <h2>{current.title}</h2>
          {current.message && (
            <div className="muted" style={{ marginTop: 8 }}>
              {current.message}
            </div>
          )}
          <div className={current.actions.length === 2 ? 'grid-2 mt-l' : 'stack mt-l'}>
            {current.actions.map((a) => (
              <button
                key={a.label}
                className={`btn ${a.kind === 'danger' ? 'danger' : a.kind === 'primary' ? 'primary' : ''}`}
                onClick={() => close(a.value)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
