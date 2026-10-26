import { useMemo, useState } from 'react';
import type { BodyPart, Equipment, Exercise, ExerciseType, Muscle } from '../types';
import { useAllExercises, useStore } from '../store/store';
import {
  ALL_MUSCLES,
  BODY_PART_COLORS,
  BODY_PART_LABELS,
  EQUIPMENT_LABELS,
  EXERCISE_TYPE_LABELS,
  MUSCLE_LABELS,
} from '../data/exercises';
import { Sheet, toast } from './ui';
import { uid } from '../lib/calc';
import { suggestMuscles } from '../lib/suggestMuscles';
import { t } from '../i18n';

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function filterExercises(all: Exercise[], query: string, part: BodyPart | 'all', equipment: Equipment | 'all') {
  const q = normalize(query.trim());
  const hits = all.filter(
    (e) =>
      (part === 'all' || e.bodyPart === part) &&
      (equipment === 'all' || e.equipment === equipment) &&
      (!q || normalize(e.name).includes(q) || e.primary.some((m) => normalize(MUSCLE_LABELS[m]).includes(q))),
  );
  if (!q) return hits;
  // Exact names first, then names starting with the query, then the rest (stable, so A–Z stays).
  const rank = (e: Exercise) => {
    const n = normalize(e.name);
    return n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : 3;
  };
  return [...hits].sort((a, b) => rank(a) - rank(b));
}

export function ExerciseFilters({
  query,
  setQuery,
  part,
  setPart,
  equipment,
  setEquipment,
}: {
  query: string;
  setQuery: (v: string) => void;
  part: BodyPart | 'all';
  setPart: (v: BodyPart | 'all') => void;
  equipment: Equipment | 'all';
  setEquipment: (v: Equipment | 'all') => void;
}) {
  return (
    <div className="stack">
      <input type="search" placeholder={t('Search exercise or muscle…')} value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="chips">
        <button className={`chip ${part === 'all' ? 'on' : ''}`} onClick={() => setPart('all')}>
          {t('All')}
        </button>
        {(Object.keys(BODY_PART_LABELS) as BodyPart[]).map((p) => (
          <button key={p} className={`chip ${part === p ? 'on' : ''}`} onClick={() => setPart(part === p ? 'all' : p)}>
            {BODY_PART_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="chips">
        {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((eq) => (
          <button
            key={eq}
            className={`chip ${equipment === eq ? 'on' : ''}`}
            onClick={() => setEquipment(equipment === eq ? 'all' : eq)}
          >
            {EQUIPMENT_LABELS[eq]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExerciseAvatar({ ex }: { ex: Exercise }) {
  const c = BODY_PART_COLORS[ex.bodyPart];
  return (
    <div className="avatar" style={{ background: `${c}22`, color: c }}>
      {ex.name.charAt(0).toUpperCase()}
    </div>
  );
}

export function ExercisePicker({
  onClose,
  onPick,
  multi = true,
  title = t('Add exercises'),
}: {
  onClose: () => void;
  onPick: (ids: string[]) => void;
  multi?: boolean;
  title?: string;
}) {
  const all = useAllExercises();
  const workouts = useStore((s) => s.workouts);
  const [query, setQuery] = useState('');
  const [part, setPart] = useState<BodyPart | 'all'>('all');
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of workouts.slice(0, 60)) for (const e of w.exercises) m.set(e.exerciseId, (m.get(e.exerciseId) ?? 0) + 1);
    return m;
  }, [workouts]);

  const list = filterExercises(all, query, part, equipment);
  const recent = !query && part === 'all' && equipment === 'all' ? list.filter((e) => usage.has(e.id)).sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0)).slice(0, 6) : [];

  const toggle = (id: string) => {
    if (!multi) {
      onPick([id]);
      onClose();
      return;
    }
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  if (creating) {
    return (
      <ExerciseForm
        onClose={() => setCreating(false)}
        initialName={query}
        onSaved={(ex) => {
          setCreating(false);
          toggle(ex.id);
        }}
      />
    );
  }

  const row = (e: Exercise) => {
    const idx = selected.indexOf(e.id);
    return (
      <button key={e.id} className={`list-item ${idx >= 0 ? 'active' : ''}`} onClick={() => toggle(e.id)}>
        <ExerciseAvatar ex={e} />
        <div className="grow">
          <div className="bold ellipsis">{e.name}</div>
          <div className="small muted">
            {BODY_PART_LABELS[e.bodyPart]} · {EQUIPMENT_LABELS[e.equipment]}
          </div>
        </div>
        {idx >= 0 && <span className="badge accent">{multi ? idx + 1 : '✓'}</span>}
      </button>
    );
  };

  return (
    <Sheet
      title={title}
      onClose={onClose}
      full
      action={
        <button className="btn ghost" onClick={() => setCreating(true)}>
          {t('New')}
        </button>
      }
    >
      <ExerciseFilters {...{ query, setQuery, part, setPart, equipment, setEquipment }} />
      {recent.length > 0 && (
        <>
          <div className="small muted bold mt">{t('Frequently used')}</div>
          <div className="list mt">{recent.map(row)}</div>
          <div className="small muted bold mt">{t('All exercises')}</div>
        </>
      )}
      <div className="list mt">
        {list.map(row)}
        {!list.length && (
          <div className="empty">
            {t('Nothing found.')}
            <div className="mt">
              <button className="btn soft" onClick={() => setCreating(true)}>
                {t('Create “{name}”', { name: query })}
              </button>
            </div>
          </div>
        )}
      </div>
      {multi && selected.length > 0 && (
        <div style={{ position: 'sticky', bottom: 0, paddingTop: 12 }}>
          <button
            className="btn primary block"
            onClick={() => {
              onPick(selected);
              onClose();
            }}
          >
            {t('Add ({n})', { n: selected.length })}
          </button>
        </div>
      )}
    </Sheet>
  );
}

export function ExerciseForm({
  onClose,
  onSaved,
  initial,
  initialName = '',
}: {
  onClose: () => void;
  onSaved?: (e: Exercise) => void;
  initial?: Exercise;
  initialName?: string;
}) {
  const saveExercise = useStore((s) => s.saveExercise);
  const allExercises = useAllExercises();
  const [name, setName] = useState(initial?.name ?? initialName);
  const [bodyPart, setBodyPart] = useState<BodyPart>(initial?.bodyPart ?? 'chest');
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? 'barbell');
  const [type, setType] = useState<ExerciseType>(initial?.type ?? 'weight_reps');
  const [primary, setPrimary] = useState<Muscle[]>(initial?.primary ?? []);
  const [secondary, setSecondary] = useState<Muscle[]>(initial?.secondary ?? []);
  const [instructions, setInstructions] = useState((initial?.instructions ?? []).join('\n'));

  const [basedOn, setBasedOn] = useState<string[]>([]);
  const suggest = (auto: boolean) => {
    const s = suggestMuscles(name, allExercises);
    if (!s) return auto ? undefined : toast(t('No similar exercise found. Pick the muscles yourself.'));
    setPrimary(s.primary);
    setSecondary(s.secondary);
    setBodyPart(s.bodyPart);
    setType(s.type);
    if (s.equipment) setEquipment(s.equipment);
    setBasedOn(s.basedOn);
  };

  const cycle = (m: Muscle) => {
    if (primary.includes(m)) {
      setPrimary(primary.filter((x) => x !== m));
      setSecondary([...secondary, m]);
    } else if (secondary.includes(m)) {
      setSecondary(secondary.filter((x) => x !== m));
    } else setPrimary([...primary, m]);
  };

  const save = () => {
    if (!name.trim()) return toast(t('Give the exercise a name'));
    const ex: Exercise = {
      id: initial?.id ?? 'custom-' + uid(),
      name: name.trim(),
      bodyPart,
      equipment,
      type,
      primary,
      secondary,
      instructions: instructions
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      custom: true,
    };
    saveExercise(ex);
    toast(initial ? t('Exercise updated') : t('Exercise created'));
    onSaved?.(ex);
    onClose();
  };

  return (
    <Sheet
      title={initial ? t('Edit exercise') : t('New exercise')}
      onClose={onClose}
      full
      action={
        <button className="btn ghost" onClick={save}>
          {t('Save')}
        </button>
      }
    >
      <div className="stack">
        <div className="field">
          <label>{t('Name')}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => !initial && !primary.length && name.trim().length > 2 && suggest(true)}
            placeholder={t('e.g. Smith machine press')}
            autoFocus
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label>{t('Body part')}</label>
            <select value={bodyPart} onChange={(e) => setBodyPart(e.target.value as BodyPart)}>
              {(Object.keys(BODY_PART_LABELS) as BodyPart[]).map((p) => (
                <option key={p} value={p}>
                  {BODY_PART_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t('Equipment')}</label>
            <select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
              {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((p) => (
                <option key={p} value={p}>
                  {EQUIPMENT_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>{t('Tracking type')}</label>
          <select value={type} onChange={(e) => setType(e.target.value as ExerciseType)}>
            {(Object.keys(EXERCISE_TYPE_LABELS) as ExerciseType[]).map((p) => (
              <option key={p} value={p}>
                {EXERCISE_TYPE_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t('Muscles (tap once = primary, twice = secondary)')}</label>
          <button className="btn soft sm" onClick={() => suggest(false)} disabled={name.trim().length < 3}>
            {t('Suggest muscles from the name')}
          </button>
          {basedOn.length > 0 && <div className="tiny muted">{t('Based on: {names}. Adjust if needed.', { names: basedOn.join(', ') })}</div>}
          <div className="row wrap" style={{ gap: 6 }}>
            {ALL_MUSCLES.map((m) => (
              <button
                key={m}
                className={`chip ${primary.includes(m) ? 'on' : ''}`}
                style={secondary.includes(m) ? { borderColor: 'var(--blue)', color: 'var(--blue)' } : undefined}
                onClick={() => cycle(m)}
              >
                {MUSCLE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>{t('How to (one step per line)')}</label>
          <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} />
        </div>
        <button className="btn primary block" onClick={save}>
          {t('Save exercise')}
        </button>
      </div>
    </Sheet>
  );
}
