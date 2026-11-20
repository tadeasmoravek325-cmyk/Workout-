import { useStore } from '../store/store';
import { defaultFocus, targetFor } from '../core/progress/engine';
import type { Exercise } from '../types';
import { t } from '../i18n';

/** Rep range, sets and reps in reserve the coach aims for on this exercise. Empty means "use the training focus". */
export function TargetEditor({ ex }: { ex: Exercise }) {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const custom = settings.exerciseTargets?.[ex.id];
  const eff = targetFor(ex.id, settings.exerciseTargets, defaultFocus(settings));

  const save = (patch: Partial<typeof eff>) => {
    const next = { ...eff, ...patch };
    // Keep the range valid: the top can never sit below the bottom.
    if (next.repMax < next.repMin) next.repMax = next.repMin;
    update({ exerciseTargets: { ...(settings.exerciseTargets ?? {}), [ex.id]: { repMin: next.repMin, repMax: next.repMax, sets: next.sets, rir: next.rir } } });
  };
  const reset = () => {
    const { [ex.id]: _drop, ...rest } = settings.exerciseTargets ?? {};
    void _drop;
    update({ exerciseTargets: rest });
  };
  const num = (label: string, value: number, min: number, max: number, on: (v: number) => void) => (
    <label className="stack" style={{ gap: 4, flex: 1 }}>
      <span className="tiny muted">{label}</span>
      <input type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => on(Math.max(min, Math.min(max, Number(e.target.value) || min)))} />
    </label>
  );

  return (
    <div className="card">
      <div className="bold">{t('Progression target')}</div>
      <div className="small muted" style={{ margin: '4px 0 10px' }}>
        {custom ? t('Set for this exercise. The coach adds weight once every set reaches the top of the range.') : t('Using your training focus. Change a value to set it for this exercise.')}
      </div>
      <div className="row" style={{ gap: 8 }}>
        {num(t('Min reps'), eff.repMin, 1, 30, (v) => save({ repMin: v }))}
        {num(t('Max reps'), eff.repMax, 1, 40, (v) => save({ repMax: v }))}
        {num(t('Sets'), eff.sets, 1, 10, (v) => save({ sets: v }))}
        {num(t('Target RIR'), eff.rir ?? 2, 0, 5, (v) => save({ rir: v }))}
      </div>
      {custom && (
        <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={reset}>
          {t('Use training focus')}
        </button>
      )}
    </div>
  );
}
