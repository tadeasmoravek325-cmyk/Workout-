import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shuffle, Sparkles } from 'lucide-react';
import { useAllExercises, useExerciseMap, useStore } from '../store/store';
import { FOCUS_LABELS, generateWorkout, type Focus } from '../lib/generator';
import { BODY_PART_COLORS, BODY_PART_EMOJI } from '../data/exercises';
import { fmtNum, toDisplayWeight } from '../lib/format';
import { ExerciseAvatar } from './ExercisePicker';
import { Sheet, toast } from './ui';

const MINUTES = [30, 45, 60, 75];

export function GeneratorSheet({ onClose }: { onClose: () => void }) {
  const all = useAllExercises();
  const exMap = useExerciseMap();
  const workouts = useStore((s) => s.workouts);
  const settings = useStore((s) => s.settings);
  const active = useStore((s) => s.active);
  const startWorkout = useStore((s) => s.startWorkout);
  const saveRoutine = useStore((s) => s.saveRoutine);
  const navigate = useNavigate();
  const [focus, setFocus] = useState<Focus>('auto');
  const [minutes, setMinutes] = useState(45);
  const [seed, setSeed] = useState(() => Date.now());

  const gen = useMemo(
    () => generateWorkout({ focus, minutes, equipment: settings.equipment, goal: settings.goal, seed }, all, workouts, exMap),
    [focus, minutes, settings.equipment, settings.goal, seed, all, workouts, exMap],
  );
  const unit = settings.unit;

  const start = () => {
    if (active) {
      toast('Už máš rozběhnutý trénink');
      return;
    }
    startWorkout(gen.routine);
    useStore.getState().mutateActive((w) => void delete w.routineId);
    onClose();
    navigate('/workout');
  };

  return (
    <Sheet title="Vygenerovat trénink" onClose={onClose} full>
      <div className="hero cool" style={{ padding: 16 }}>
        <div className="row">
          <Sparkles size={22} />
          <div className="bold">Trénink na míru</div>
        </div>
        <div className="small muted" style={{ marginTop: 4 }}>
          Sestavíme ho podle regenerace svalů, tvého cíle, vybavení a historie. Váhy navrhne chytrý trenér.
        </div>
      </div>

      <div className="field mt-l">
        <label>Zaměření</label>
        <div className="chips">
          {(Object.keys(FOCUS_LABELS) as Focus[]).map((f) => (
            <button key={f} className={`chip ${focus === f ? 'on' : ''}`} onClick={() => setFocus(f)}>
              {FOCUS_LABELS[f]}
            </button>
          ))}
        </div>
      </div>
      <div className="field mt">
        <label>Délka</label>
        <div className="row" style={{ gap: 8 }}>
          {MINUTES.map((m) => (
            <button key={m} className={`btn sm grow ${minutes === m ? 'primary' : ''}`} onClick={() => setMinutes(m)}>
              {m} min
            </button>
          ))}
        </div>
      </div>

      <div className="row between mt-l">
        <h3>
          {focus === 'auto' ? `Dnes doporučujeme: ${FOCUS_LABELS[gen.focus]}` : FOCUS_LABELS[gen.focus]}
        </h3>
        <button className="btn sm soft" onClick={() => setSeed((s) => s + 7)}>
          <Shuffle size={15} /> Jiné cviky
        </button>
      </div>
      <div className="list mt">
        {gen.routine.exercises.map((re) => {
          const ex = exMap.get(re.exerciseId);
          if (!ex) return null;
          const s = re.sets[0];
          return (
            <div key={re.id} className="list-item">
              <ExerciseAvatar ex={ex} />
              <div className="grow">
                <div className="bold ellipsis">{ex.name}</div>
                <div className="small muted">
                  <span style={{ color: BODY_PART_COLORS[ex.bodyPart] }}>{BODY_PART_EMOJI[ex.bodyPart]}</span> {re.sets.length} ×{' '}
                  {s.durationSec ? `${s.durationSec} s` : `${s.reps} opak.`}
                  {s.weight ? ` · ${fmtNum(toDisplayWeight(s.weight, unit))} ${unit}` : ''}
                </div>
              </div>
            </div>
          );
        })}
        {!gen.routine.exercises.length && <div className="empty">S vybraným vybavením nic nenajdeme. Uprav vybavení v Nastavení.</div>}
      </div>

      <div className="stack mt-l">
        <button className="btn primary lg block" onClick={start} disabled={!gen.routine.exercises.length}>
          Začít trénink
        </button>
        <button
          className="btn block"
          onClick={() => {
            saveRoutine({ ...gen.routine, folder: 'Vygenerované' });
            toast('Uloženo mezi rutiny');
          }}
        >
          Uložit jako rutinu
        </button>
      </div>
    </Sheet>
  );
}
