import { useMemo, useState } from 'react';
import { useExerciseMap, useStore } from '../store/store';
import { defaultFocus } from '../core/progress/engine';
import { KIND_LABEL, suggestTarget, targetForExercise } from '../core/progress/ranges';
import { confirmDialog, toast } from './ui';
import type { ExerciseTarget, Phase } from '../types';
import { t } from '../i18n';

const PHASE_LABEL: Record<Phase, string> = { cut: 'Cutting', maintain: 'Maintaining', bulk: 'Bulking' };
const FOCUS_LABEL = { strength: 'Strength', hypertrophy: 'Muscle', both: 'Both' } as const;

// Only the rep range and RIR decide whether a suggestion differs: the number of sets always follows your routine.
const same = (a: ExerciseTarget, b: ExerciseTarget) => a.repMin === b.repMin && a.repMax === b.repMax && (a.rir ?? 2) === (b.rir ?? 2);
const fmt = (x: ExerciseTarget) => `${x.repMin}–${x.repMax} reps × ${x.sets}, RIR ${x.rir ?? 2}`;

const SOURCES = [
  ['Lopez 2021: load and hypertrophy, network meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/33433148/'],
  ['Schoenfeld 2017: low vs high load, meta-analysis', 'https://pubmed.ncbi.nlm.nih.gov/28834797/'],
  ['Murphy & Koehler 2022: energy deficit and resistance training', 'https://pubmed.ncbi.nlm.nih.gov/34623696/'],
  ['Spiering 2021: minimal dose to maintain performance', 'https://pubmed.ncbi.nlm.nih.gov/33629972/'],
  ['Refalo 2023: proximity to failure and hypertrophy', 'https://pubmed.ncbi.nlm.nih.gov/36334240/'],
  ['Roth 2022: volume and lean mass in a deficit', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9012799'],
] as const;

/**
 * Suggested rep ranges for every weighted exercise in your routines, based on your body goal (cutting, maintaining,
 * bulking), training focus and the kind of exercise. Nothing changes until you apply it.
 */
export function RangeSuggestions() {
  const routines = useStore((s) => s.routines);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const exMap = useExerciseMap();
  const focus = defaultFocus(settings);
  const phase = settings.phase ?? 'maintain';
  // Explicit ticks by the user; without one a range is ticked unless it is up to date or one you set yourself.
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [why, setWhy] = useState(false);

  const rows = useMemo(() => {
    const planned = new Map<string, { sets: number; reps: number[] }>();
    for (const r of routines)
      for (const re of r.exercises) {
        const work = re.sets.filter((s) => s.type !== 'warmup');
        const cur = planned.get(re.exerciseId) ?? { sets: 0, reps: [] };
        cur.sets = Math.max(cur.sets, work.length);
        cur.reps.push(...work.map((s) => s.reps ?? 0).filter((x) => x > 0));
        planned.set(re.exerciseId, cur);
      }
    return [...planned.entries()]
      .map(([id, p]) => {
        const ex = exMap.get(id);
        if (!ex || ex.type !== 'weight_reps') return null;
        const sug = suggestTarget(ex, { focus, phase, plannedSets: p.sets });
        const now = targetForExercise(ex, settings);
        const custom = !!settings.exerciseTargets?.[id];
        const plan = p.reps.length ? `${Math.min(...p.reps)}${Math.max(...p.reps) !== Math.min(...p.reps) ? `–${Math.max(...p.reps)}` : ''}` : null;
        return { id, ex, sug, now, custom, plan, upToDate: same(sug.target, now) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.ex.name.localeCompare(b.ex.name));
  }, [routines, exMap, settings, focus, phase]);

  if (!rows.length) return null;
  const checked = (r: (typeof rows)[number]) => !r.upToDate && (ticks[r.id] ?? !r.custom);
  const toggle = (r: (typeof rows)[number]) => setTicks((t0) => ({ ...t0, [r.id]: !checked(r) }));

  const apply = async () => {
    const picked = rows.filter(checked);
    if (!picked.length) return;
    if (!(await confirmDialog(t('Apply rep ranges?'), t('{n} exercises get the suggested range. You can change any of them later in the exercise.', { n: picked.length }), t('Apply'), false))) return;
    const next = { ...(settings.exerciseTargets ?? {}) };
    for (const r of picked) next[r.id] = r.sug.target;
    update({ exerciseTargets: next });
    setTicks({});
    toast(t('Rep ranges updated'));
  };

  return (
    <div className="card mt">
      <div className="bold">{t('Rep ranges for your routines')}</div>
      <div className="small muted" style={{ margin: '4px 0 8px' }}>
        {t(PHASE_LABEL[phase])} · {t(FOCUS_LABEL[focus])}
      </div>
      {rows.map((r) => (
        <label key={r.id} className="row" style={{ gap: 10, padding: '7px 0', alignItems: 'flex-start' }}>
          <input type="checkbox" disabled={r.upToDate} checked={checked(r)} onChange={() => toggle(r)} style={{ width: 20, height: 20, flex: 'none', marginTop: 2 }} />
          <span className="grow">
            <span className="small bold">{r.ex.name}</span> <span className="tiny muted">· {t(KIND_LABEL[r.sug.kind])}</span>
            <span className="tiny muted" style={{ display: 'block' }}>
              {r.upToDate ? t('Following your settings: {x}', { x: fmt(r.now) }) : `${t('Now')}: ${r.now.repMin}–${r.now.repMax}${r.custom ? ` (${t('yours')})` : ''} → ${fmt(r.sug.target)}`}
              {r.plan && ` · ${t('routine plans {n}', { n: r.plan })}`}
            </span>
          </span>
        </label>
      ))}
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button className="btn sm primary" disabled={!rows.some(checked)} onClick={() => void apply()}>
          {t('Apply to {n}', { n: rows.filter(checked).length })}
        </button>
        <button className="btn sm ghost" onClick={() => setWhy((v) => !v)}>
          {t('Why these ranges')}
        </button>
      </div>
      {why && (
        <div className="small muted" style={{ marginTop: 10 }}>
          <p>{t('Muscle growth is similar across a wide range of loads when sets end close to failure, and heavier loads build more strength. So the range mostly follows the exercise: heavy barbell lifts lowest, isolation exercises highest.')}</p>
          <p>{t('In a calorie deficit, muscle gain is impaired while strength is kept, and heavy training is what protects muscle, while volume can drop. So when cutting the ranges move about 2 reps lower and holding your weights counts as progress.')}</p>
          <p>{t('These numbers are practical rules of thumb built on that evidence, not prescriptions. Treat them as a starting point.')}</p>
          {SOURCES.map(([title, url]) => (
            <div key={url}>
              <a href={url} target="_blank" rel="noreferrer">
                {title}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
