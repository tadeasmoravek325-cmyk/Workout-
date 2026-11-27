import { useStore } from '../store/store';
import { KIND_LABEL, exerciseKind, profileFor, targetForExercise } from '../core/progress/ranges';
import { weightIncrement } from '../core/progress/increment';
import { fmtNum, fromDisplayWeight, toDisplayWeight } from '../lib/format';
import type { Exercise, ExerciseTarget } from '../types';
import { t } from '../i18n';

/**
 * Double progression settings for one exercise: working sets, rep range, target RIR, starting weight and the load added
 * when the top of the range is reached. Untouched exercises follow your training focus and body goal.
 */
export function TargetEditor({ ex }: { ex: Exercise }) {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const unit = settings.unit;
  const custom = settings.exerciseTargets?.[ex.id];
  const eff = targetForExercise(ex, settings);
  const defaultInc = weightIncrement(ex);
  const isTime = ex.type === 'duration';
  const hasLoad = ex.type === 'weight_reps' || ex.type === 'weighted_bodyweight' || ex.type === 'assisted_bodyweight';
  const assisted = ex.type === 'assisted_bodyweight';

  const save = (patch: Partial<ExerciseTarget>) => {
    // Saving makes the range yours, and yours is strict: no tolerance.
    const next: ExerciseTarget = { ...eff, ...patch, tolerance: undefined };
    // Keep the range valid: the top can never sit below the bottom.
    if (next.repMax < next.repMin) next.repMax = next.repMin;
    update({ exerciseTargets: { ...(settings.exerciseTargets ?? {}), [ex.id]: next } });
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
  const kg = (label: string, valueKg: number | undefined, placeholderKg: number | undefined, on: (kg: number | undefined) => void) => (
    <label className="stack" style={{ gap: 4, flex: 1 }}>
      <span className="tiny muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={0.5}
        value={valueKg === undefined ? '' : (toDisplayWeight(valueKg, unit) ?? '')}
        placeholder={placeholderKg === undefined ? '–' : fmtNum(toDisplayWeight(placeholderKg, unit))}
        onChange={(e) => {
          const raw = e.target.value;
          on(raw === '' ? undefined : fromDisplayWeight(Number(raw), unit));
        }}
      />
    </label>
  );

  return (
    <div className="card">
      <div className="bold">
        {t('Progression target')} <span className="tiny muted">· {t(KIND_LABEL[exerciseKind(ex)])}</span>
      </div>
      <div className="small muted" style={{ margin: '4px 0 10px' }}>
        {custom ? t('Your own range. The coach adds weight once every set reaches the top of it.') : `${profileFor(ex)?.why ?? t('Recommended from your training focus, body goal and this exercise.')} ${t('It is a guide: going a rep or two outside it is fine. Change a value to set your own.')}`}
      </div>
      <div className="row" style={{ gap: 8 }}>
        {num(t('Sets'), eff.sets, 1, 10, (v) => save({ sets: v }))}
        {num(isTime ? t('Min (s)') : t('Min reps'), eff.repMin, 1, isTime ? 600 : 30, (v) => save({ repMin: v }))}
        {num(isTime ? t('Max (s)') : t('Max reps'), eff.repMax, 1, isTime ? 1800 : 40, (v) => save({ repMax: v }))}
        {!isTime && num(t('Target RIR'), eff.rir ?? 2, 0, 5, (v) => save({ rir: v }))}
        {isTime && num(t('Step (s)'), eff.increment ?? 5, 1, 60, (v) => save({ increment: v }))}
      </div>
      {hasLoad && (
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          {kg(`${assisted ? t('Start assistance') : ex.type === 'weighted_bodyweight' ? t('Added weight') : t('Start weight')} (${unit})`, eff.startWeight, undefined, (v) => save({ startWeight: v }))}
          {kg(`${assisted ? t('Assistance step') : t('Increment')} (${unit})`, eff.increment, defaultInc, (v) => save({ increment: v }))}
        </div>
      )}
      {custom && (
        <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={reset}>
          {t('Use training focus')}
        </button>
      )}
    </div>
  );
}
