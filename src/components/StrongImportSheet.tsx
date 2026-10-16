import { useMemo, useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { useAllExercises, useExerciseMap, useStore } from '../store/store';
import { analyzeStrongCsv, buildStrongImport, type StrongAnalysis } from '../lib/csv';
import type { Unit } from '../types';
import { ExercisePicker } from './ExercisePicker';
import { Segmented, Sheet, Switch, toast } from './ui';

/**
 * Two-step Strong import: the user reviews how every Strong exercise maps to the library
 * before anything is written. Unmatched names become their own exercises, never merged.
 */
export function StrongImportSheet({ text, onClose }: { text: string; onClose: () => void }) {
  const all = useAllExercises();
  const exMap = useExerciseMap();
  const settingsUnit = useStore((s) => s.settings.unit);
  const importWorkouts = useStore((s) => s.importWorkouts);
  const [unit, setUnit] = useState<Unit>(settingsUnit);
  const [replace, setReplace] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const analysis = useMemo<StrongAnalysis | { error: string }>(() => {
    try {
      return analyzeStrongCsv(text, all);
    } catch (e) {
      return { error: (e as Error).message };
    }
    // The library is read once when the sheet opens; later edits must not reshuffle the mapping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const [mapping, setMapping] = useState<Record<string, string | null>>(() =>
    'error' in analysis ? {} : Object.fromEntries(analysis.exercises.map((e) => [e.key, e.suggested])),
  );

  if ('error' in analysis) {
    return (
      <Sheet title="Import from Strong" onClose={onClose}>
        <div className="card">
          <div className="bold danger">Can't read this file</div>
          <div className="small muted" style={{ marginTop: 6 }}>
            {analysis.error}
          </div>
        </div>
      </Sheet>
    );
  }

  const matched = analysis.exercises.filter((e) => mapping[e.key]).length;
  const totalSets = analysis.exercises.reduce((a, e) => a + e.sets, 0);

  const run = () => {
    const result = buildStrongImport(analysis, mapping, unit, all);
    const n = importWorkouts(result.workouts, result.newExercises, replace);
    toast(`Imported ${n} workout${n === 1 ? '' : 's'}`);
    onClose();
  };

  return (
    <Sheet title="Import from Strong" onClose={onClose} full>
      <div className="grid-2">
        <div className="stat">
          <div className="v">{analysis.workoutCount}</div>
          <div className="l">workouts</div>
        </div>
        <div className="stat">
          <div className="v">{totalSets}</div>
          <div className="l">sets</div>
        </div>
      </div>

      {analysis.unitFromFile ? (
        <div className="small muted mt">Weights are in {analysis.unitFromFile}, read from the file.</div>
      ) : (
        <div className="field mt">
          <label>Weight unit used in Strong</label>
          <Segmented
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
          />
        </div>
      )}

      <div className="section-title mt-l">
        <h2>Exercises</h2>
        <span className="small muted">
          {matched} matched · {analysis.exercises.length - matched} new
        </span>
      </div>
      <p className="small muted" style={{ marginTop: -4 }}>
        Check that every exercise lands where it should. Tap a row to change it. Names that don't match exactly become new
        exercises, so different movements are never merged.
      </p>
      <div className="list">
        {analysis.exercises.map((e) => {
          const target = mapping[e.key];
          const ex = target ? exMap.get(target) : undefined;
          return (
            <button key={e.key} className="list-item" onClick={() => setEditing(e.key)}>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="bold ellipsis">{e.name}</div>
                <div className="small muted row" style={{ gap: 6 }}>
                  <ArrowRight size={13} aria-hidden="true" />
                  <span className={`ellipsis ${ex ? 'accent' : ''}`}>{ex ? ex.name : 'New exercise'}</span>
                </div>
              </div>
              <span className="small muted">{e.sets} sets</span>
            </button>
          );
        })}
      </div>

      <div className="card mt-l row between">
        <div className="grow">
          <div className="bold">Replace earlier Strong import</div>
          <div className="small muted">Removes workouts that start at the same time as ones in this file, then imports them again.</div>
        </div>
        <Switch on={replace} onChange={setReplace} label="Replace earlier import" />
      </div>

      <div style={{ position: 'sticky', bottom: 0, paddingTop: 16, background: 'var(--bg-2)' }}>
        <button className="btn primary block" onClick={run}>
          Import {analysis.workoutCount} workouts
        </button>
        <div className="tiny muted center mt">A backup of your current data is saved automatically first.</div>
      </div>

      {editing && (
        <MappingPicker
          name={analysis.exercises.find((e) => e.key === editing)!.name}
          onNew={() => {
            setMapping((m) => ({ ...m, [editing]: null }));
            setEditing(null);
          }}
          onPick={(id) => {
            setMapping((m) => ({ ...m, [editing]: id }));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </Sheet>
  );
}

function MappingPicker({
  name,
  onPick,
  onNew,
  onClose,
}: {
  name: string;
  onPick: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const [picking, setPicking] = useState(false);
  if (picking) return <ExercisePicker multi={false} title={`Match “${name}”`} onClose={onClose} onPick={(ids) => onPick(ids[0])} />;
  return (
    <Sheet title={name} onClose={onClose}>
      <div className="stack">
        <button className="btn primary block" onClick={() => setPicking(true)}>
          Match to an exercise
        </button>
        <button className="btn block" onClick={onNew}>
          <Plus size={18} aria-hidden="true" /> Keep as a new exercise
        </button>
      </div>
    </Sheet>
  );
}
