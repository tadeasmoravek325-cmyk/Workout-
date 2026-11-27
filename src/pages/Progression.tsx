import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllExercises, useStore } from '../store/store';
import { KIND_LABEL, exerciseKind, targetForExercise } from '../core/progress/ranges';
import { weightIncrement } from '../core/progress/increment';
import { TargetEditor } from '../components/TargetEditor';
import { BackLabel } from '../components/ui';
import { fmtNum, toDisplayWeight } from '../lib/format';
import { t } from '../i18n';

/** Double progression settings for every weighted exercise in the database. Tap one to edit it. */
export default function Progression() {
  const navigate = useNavigate();
  const all = useAllExercises();
  const settings = useStore((s) => s.settings);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      all
        .filter((e) => e.type === 'weight_reps' && e.name.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [all, query],
  );
  const unit = settings.unit;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          <BackLabel />
        </button>
      </div>
      <h1 style={{ fontSize: 24 }}>{t('Progression targets')}</h1>
      <div className="small muted" style={{ margin: '4px 0 12px' }}>
        {t('Sets, rep range, RIR, start weight and increment for every weighted exercise. Exercises you do not change follow your training focus and body goal.')}
      </div>
      <input type="search" placeholder={t('Search exercises')} value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: '100%', marginBottom: 10 }} />
      <div className="list">
        {rows.map((e) => {
          const tg = targetForExercise(e, settings);
          const own = !!settings.exerciseTargets?.[e.id];
          return (
            <div key={e.id}>
              <button className="list-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpen(open === e.id ? null : e.id)}>
                <div className="grow">
                  <div className="bold ellipsis">
                    {e.name} {own && <span className="badge">{t('custom')}</span>}
                  </div>
                  <div className="small muted">
                    {tg.sets} × {tg.repMin}–{tg.repMax} · RIR {tg.rir ?? 2} · +{fmtNum(toDisplayWeight(tg.increment ?? weightIncrement(e), unit))} {unit}
                    {tg.startWeight ? ` · ${t('start')} ${fmtNum(toDisplayWeight(tg.startWeight, unit))} ${unit}` : ''} · {t(KIND_LABEL[exerciseKind(e)])}
                  </div>
                </div>
              </button>
              {open === e.id && (
                <div style={{ padding: '0 0 10px' }}>
                  <TargetEditor ex={e} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
