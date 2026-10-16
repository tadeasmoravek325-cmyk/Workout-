import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BodyPart, Equipment } from '../types';
import { useAllExercises, useStore } from '../store/store';
import { ExerciseAvatar, ExerciseFilters, ExerciseForm, filterExercises } from '../components/ExercisePicker';
import { BODY_PART_LABELS, EQUIPMENT_LABELS } from '../data/exercises';
import { relativeDay } from '../lib/format';

export default function Exercises() {
  const all = useAllExercises();
  const workouts = useStore((s) => s.workouts);
  const [query, setQuery] = useState('');
  const [part, setPart] = useState<BodyPart | 'all'>('all');
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [sort, setSort] = useState<'name' | 'used'>('name');

  const stats = useMemo(() => {
    const m = new Map<string, { count: number; last: number }>();
    for (const w of workouts)
      for (const e of w.exercises) {
        const s = m.get(e.exerciseId) ?? { count: 0, last: 0 };
        s.count++;
        s.last = Math.max(s.last, w.startedAt);
        m.set(e.exerciseId, s);
      }
    return m;
  }, [workouts]);

  let list = filterExercises(all, query, part, equipment);
  if (sort === 'used') list = [...list].sort((a, b) => (stats.get(b.id)?.count ?? 0) - (stats.get(a.id)?.count ?? 0));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Cviky</h1>
        <button className="btn soft sm" onClick={() => setCreating(true)}>
          + Nový
        </button>
      </div>
      <ExerciseFilters {...{ query, setQuery, part, setPart, equipment, setEquipment }} />
      <div className="row between mt">
        <span className="small muted">{list.length} cviků</span>
        <div className="segmented" style={{ width: 200 }}>
          <button className={sort === 'name' ? 'on' : ''} onClick={() => setSort('name')}>
            A–Z
          </button>
          <button className={sort === 'used' ? 'on' : ''} onClick={() => setSort('used')}>
            Nejčastější
          </button>
        </div>
      </div>
      <div className="list mt">
        {list.map((e) => {
          const s = stats.get(e.id);
          return (
            <Link key={e.id} to={`/exercises/${e.id}`} className="list-item">
              <ExerciseAvatar ex={e} />
              <div className="grow">
                <div className="bold ellipsis">
                  {e.name} {e.custom && <span className="badge">vlastní</span>}
                </div>
                <div className="small muted">
                  {BODY_PART_LABELS[e.bodyPart]} · {EQUIPMENT_LABELS[e.equipment]}
                  {s && ` · ${s.count}× · ${relativeDay(s.last)}`}
                </div>
              </div>
              <span className="chev" />
            </Link>
          );
        })}
      </div>
      {creating && <ExerciseForm onClose={() => setCreating(false)} initialName={query} />}
    </div>
  );
}
