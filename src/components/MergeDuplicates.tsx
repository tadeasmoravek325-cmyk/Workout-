import { useMemo, useState } from 'react';
import { useAllExercises, useStore } from '../store/store';
import { findDuplicates } from '../lib/mergeExercises';
import { confirmDialog, Sheet, toast } from './ui';
import { t, tn } from '../i18n';

/** Card on the exercise list that offers to fold duplicate exercises together. */
export function MergeDuplicates() {
  const all = useAllExercises();
  const workouts = useStore((s) => s.workouts);
  const merge = useStore((s) => s.mergeExercises);
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const uses = new Map<string, number>();
    for (const w of workouts) for (const e of w.exercises) uses.set(e.exerciseId, (uses.get(e.exerciseId) ?? 0) + 1);
    return findDuplicates(all, uses).map((g) => ({ ...g, uses }));
  }, [all, workouts]);

  if (!groups.length) return null;

  const run = async (g: (typeof groups)[number]) => {
    const n = g.sources.reduce((a, s) => a + (g.uses.get(s.id) ?? 0), 0);
    const ok = await confirmDialog(
      t('Merge exercises?'),
      tn(n, 'Its {n} entry moves to "{name}". A restore point is saved first, nothing is lost.', 'Its {n} entries move to "{name}". A restore point is saved first, nothing is lost.').replace('{name}', g.target.name),
      t('Merge'),
    );
    if (!ok) return;
    for (const s of g.sources) merge(s.id, g.target.id);
    toast(t('Merged'));
  };

  return (
    <>
      <button className="card merge-card" onClick={() => setOpen(true)}>
        <div className="bold">{tn(groups.length, '{n} duplicate exercise', '{n} duplicate exercises')}</div>
        <div className="small muted">{t('Review and merge without losing any data')}</div>
      </button>
      {open && (
        <Sheet title={t('Duplicate exercises')} onClose={() => setOpen(false)}>
          <div className="list">
            {groups.map((g) => (
              <div key={g.target.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="bold">{g.target.name}</div>
                  <div className="small muted">
                    {t('Same as')}: {g.sources.map((s) => `${s.name} (${g.uses.get(s.id) ?? 0}×)`).join(', ')}
                  </div>
                </div>
                <button className="btn soft sm" onClick={() => void run(g)}>
                  {t('Merge')}
                </button>
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
