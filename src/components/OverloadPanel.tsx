import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { Session } from '../lib/calc';
import { overloadSeries, overloadState } from '../lib/overload';
import { fmtDate, fmtNum, toDisplayWeight } from '../lib/format';
import { useStore } from '../store/store';
import { t } from '../i18n';

/** Progressive overload for one lift: are strength and work done climbing over the last sessions? */
export function OverloadPanel({ sessions }: { sessions: Session[] }) {
  const unit = useStore((s) => s.settings.unit);
  const series = overloadSeries(sessions, 6);
  if (series.length < 2) return null;
  const { state, change } = overloadState(overloadSeries(sessions));
  const Icon = state === 'up' ? TrendingUp : state === 'down' ? TrendingDown : Minus;
  const label =
    state === 'up' ? t('Progressing') : state === 'down' ? t('Going backwards') : state === 'flat' ? t('Plateau') : t('Collecting data');
  return (
    <div className="card mt">
      <div className="row between">
        <div className="bold">{t('Progressive overload')}</div>
        <div className={`overload-${state} row`} style={{ gap: 6 }}>
          <Icon size={16} aria-hidden="true" />
          <span className="bold small">
            {label}
            {state !== 'new' && ` ${change > 0 ? '+' : ''}${fmtNum(change, 1)}%`}
          </span>
        </div>
      </div>
      <div className="small muted" style={{ margin: '4px 0 8px' }}>
        {t('Compares your last 2 sessions with the 2 before.')}
      </div>
      {[...series].reverse().map((p, i, a) => {
        const prev = a[i + 1];
        const d = prev ? p.e1rm - prev.e1rm : 0;
        return (
          <div key={p.date} className="row between small" style={{ padding: '3px 0' }}>
            <span className="muted">{fmtDate(p.date)}</span>
            <span>
              {fmtNum(toDisplayWeight(p.e1rm, unit))} {unit} e1RM
              {prev && d !== 0 && <span className={d > 0 ? 'overload-up' : 'overload-down'}> {d > 0 ? '▲' : '▼'}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
