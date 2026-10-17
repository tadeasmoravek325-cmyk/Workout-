import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import type { Exercise, Muscle, Workout } from '../types';
import { useExerciseMap, useStore } from '../store/store';
import { doneSetCount, setsPerMuscle, workoutDurationMs, workoutVolume } from '../lib/calc';
import { fmtVolume, relativeDay, splitUnit } from '../lib/format';

import { ANATOMY } from '../data/anatomy';
import { BodyMap, IDLE, loadColor } from './BodyMap';
import { LOCALE_TAG, t, tn } from '../i18n';
import './WorkoutCard.css';

type Load = Partial<Record<Muscle, number>>;

/** Muscles drawn on each side of the body (the same for both body models). */
const SIDE_MUSCLES = {
  front: new Set(ANATOMY.male.front.regions.flatMap((r) => r.m ?? [])),
  back: new Set(ANATOMY.male.back.regions.flatMap((r) => r.m ?? [])),
};

/** Fractional working sets per muscle for one workout. */
export function workoutMuscleSets(w: Workout, exMap: Map<string, Exercise>): Load {
  return setsPerMuscle([w], exMap, 0);
}

/** The side of the body that carries more of the workout's load. */
export function busierSide(load: Load): 'front' | 'back' {
  let front = 0;
  let back = 0;
  for (const [m, v] of Object.entries(load) as [Muscle, number][]) {
    if (SIDE_MUSCLES.front.has(m)) front += v;
    if (SIDE_MUSCLES.back.has(m)) back += v;
  }
  return back > front ? 'back' : 'front';
}

function durationParts(ms: number): [string, string] {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return [String(min), t('min')];
  return [`${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`, t('h')];
}

const SHOWN = 3;

export function WorkoutCard({ w, prCount }: { w: Workout; prCount?: number }) {
  const exMap = useExerciseMap();
  const unit = useStore((s) => s.settings.unit);
  const load = useMemo(() => workoutMuscleSets(w, exMap), [w, exMap]);
  const side = busierSide(load);
  const max = Math.max(0, ...Object.values(load).map((v) => v ?? 0));
  const color = (m: Muscle) => {
    const v = load[m] ?? 0;
    return v < 0.25 || !max ? IDLE : loadColor(0.3 + (0.7 * v) / max);
  };

  const d = new Date(w.startedAt);
  const weekday = d.toLocaleDateString(LOCALE_TAG, { weekday: 'short' });
  const month = d.toLocaleDateString(LOCALE_TAG, { month: 'short' });
  const time = d.toLocaleTimeString(LOCALE_TAG, { hour: '2-digit', minute: '2-digit' });

  const [durV, durU] = durationParts(workoutDurationMs(w));
  const [volV, volU] = splitUnit(fmtVolume(workoutVolume(w, exMap), unit));
  const sets = doneSetCount(w);
  const rest = w.exercises.length - SHOWN;
  const prs = prCount ?? 0;
  const recent = Date.now() - w.startedAt < 6 * 86_400_000;

  return (
    <Link to={`/history/${w.id}`} className={`card tap wcard ${prs ? 'has-pr' : ''}`}>
      <div className="wcard-head">
        <div className="wcard-date" aria-hidden>
          <span className="wd">{weekday}</span>
          <span className="dn">{d.getDate()}</span>
          <span className="mo">{month}</span>
        </div>
        <div className="wcard-title">
          <h3 className="ellipsis">{w.name}</h3>
          <div className="small muted ellipsis">
            {recent ? `${relativeDay(w.startedAt)} · ` : ''}
            {time} · {tn(w.exercises.length, '{n} exercise', '{n} exercises')}
          </div>
        </div>
        {prs > 0 && (
          <span className="wcard-pr" aria-label={tn(prs, '{n} personal record', '{n} personal records')}>
            <Trophy size={16} strokeWidth={2.6} />
            <b>{prs}</b>
            <span>{t('PR')}</span>
          </span>
        )}
      </div>

      <div className="wcard-body">
        <div className="wcard-main">
          <div className="wcard-stats">
            <div>
              <b>{durV}</b>
              <span>{durU}</span>
            </div>
            <div>
              <b>{volV}</b>
              <span>{volU}</span>
            </div>
            <div>
              <b>{sets}</b>
              <span>{tn(sets, 'set', 'sets')}</span>
            </div>
          </div>
          <ul className="wcard-ex">
            {w.exercises.slice(0, SHOWN).map((e) => {
              const n = e.sets.filter((s) => s.done).length || e.sets.length;
              return (
                <li key={e.id} className="ellipsis">
                  <span className="n">{n} ×</span> {exMap.get(e.exerciseId)?.name ?? t('Unknown exercise')}
                </li>
              );
            })}
            {rest > 0 && <li className="more">{t('+{n} more', { n: rest })}</li>}
          </ul>
        </div>
        {max > 0 && (
          <div className="wcard-map">
            <BodyMap side={side} labels={false} height={98} color={color} value={(m) => load[m] ?? 0} />
          </div>
        )}
      </div>
    </Link>
  );
}
