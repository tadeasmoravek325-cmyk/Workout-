import type { BodyPart, Equipment, Exercise, ExerciseType, SetType, Unit, Workout, WorkoutExercise } from '../types';
import { uid } from './calc';
import { KG_PER_LB } from './format';

/** Parses CSV text (RFC 4180 quoting). Detects `,` or `;` delimiter from the header line. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

function csvEscape(v: string | number | undefined): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Strong exercise names → built-in ids. Keys are lower-case. */
const STRONG_NAMES: Record<string, string> = {
  'bench press (barbell)': 'bench-press',
  'incline bench press (barbell)': 'incline-bench-press',
  'decline bench press (barbell)': 'decline-bench-press',
  'bench press (dumbbell)': 'db-bench-press',
  'incline bench press (dumbbell)': 'db-incline-press',
  'chest fly (dumbbell)': 'db-fly',
  'cable crossover': 'cable-fly',
  'chest fly': 'pec-deck',
  'chest press (machine)': 'chest-press-machine',
  'push up': 'push-up',
  'chest dip': 'dips',
  dip: 'dips',
  'deadlift (barbell)': 'deadlift',
  'sumo deadlift (barbell)': 'sumo-deadlift',
  'bent over row (barbell)': 'barbell-row',
  'pendlay row (barbell)': 'pendlay-row',
  'bent over one arm row (dumbbell)': 'db-row',
  'pull up': 'pull-up',
  'pull up (assisted)': 'assisted-pull-up',
  'chin up': 'chin-up',
  'lat pulldown (cable)': 'lat-pulldown',
  'seated row (cable)': 'seated-cable-row',
  't bar row': 't-bar-row',
  'seated row (machine)': 'machine-row',
  'shrug (barbell)': 'shrug',
  'shrug (dumbbell)': 'db-shrug',
  'back extension': 'back-extension',
  'squat (barbell)': 'squat',
  'front squat (barbell)': 'front-squat',
  'goblet squat (kettlebell)': 'goblet-squat',
  'goblet squat (dumbbell)': 'goblet-squat',
  'leg press': 'leg-press',
  'hack squat': 'hack-squat',
  'bulgarian split squat': 'bulgarian-split-squat',
  'lunge (dumbbell)': 'lunge',
  'romanian deadlift (barbell)': 'romanian-deadlift',
  'romanian deadlift (dumbbell)': 'db-romanian-deadlift',
  'leg extension (machine)': 'leg-extension',
  'lying leg curl (machine)': 'leg-curl',
  'seated leg curl (machine)': 'seated-leg-curl',
  'hip thrust (barbell)': 'hip-thrust',
  'glute bridge': 'glute-bridge',
  'standing calf raise (machine)': 'standing-calf-raise',
  'seated calf raise (machine)': 'seated-calf-raise',
  'hip adductor (machine)': 'hip-adduction',
  'hip abductor (machine)': 'hip-abduction',
  'overhead press (barbell)': 'ohp',
  'strict military press (barbell)': 'ohp',
  'shoulder press (dumbbell)': 'db-shoulder-press',
  'seated overhead press (dumbbell)': 'db-shoulder-press',
  'arnold press (dumbbell)': 'arnold-press',
  'shoulder press (machine)': 'machine-shoulder-press',
  'lateral raise (dumbbell)': 'lateral-raise',
  'lateral raise (cable)': 'cable-lateral-raise',
  'front raise (dumbbell)': 'front-raise',
  'reverse fly (dumbbell)': 'rear-delt-fly',
  'reverse fly (machine)': 'reverse-pec-deck',
  'face pull (cable)': 'face-pull',
  'upright row (barbell)': 'upright-row',
  'bicep curl (barbell)': 'barbell-curl',
  'ez bar curl': 'ez-curl',
  'bicep curl (dumbbell)': 'db-curl',
  'hammer curl (dumbbell)': 'hammer-curl',
  'incline curl (dumbbell)': 'incline-db-curl',
  'preacher curl (barbell)': 'preacher-curl',
  'bicep curl (cable)': 'cable-curl',
  'triceps pushdown (cable - straight bar)': 'triceps-pushdown',
  'triceps pushdown (cable)': 'triceps-pushdown',
  'triceps rope pushdown': 'triceps-pushdown',
  'triceps extension (cable)': 'overhead-triceps-extension',
  'skullcrusher (barbell)': 'skull-crusher',
  'bench press - close grip (barbell)': 'close-grip-bench',
  'triceps kickback (dumbbell)': 'db-kickback',
  'wrist curl (dumbbell)': 'wrist-curl',
  plank: 'plank',
  'side plank': 'side-plank',
  crunch: 'crunch',
  'cable crunch': 'cable-crunch',
  'hanging leg raise': 'hanging-leg-raise',
  'ab wheel': 'ab-wheel',
  'russian twist': 'russian-twist',
  'power clean': 'power-clean',
  'kettlebell swing': 'kb-swing',
  "farmer's walk": 'farmers-walk',
  burpee: 'burpee',
  'running (outdoor)': 'running',
  running: 'running',
  'running (treadmill)': 'treadmill',
  'cycling (indoor)': 'cycling',
  cycling: 'cycling',
  'rowing (machine)': 'rowing',
  elliptical: 'elliptical',
  'jump rope': 'jump-rope',
  'climbing stairs': 'stair-climber',
};

function guessEquipment(name: string): Equipment {
  const n = name.toLowerCase();
  if (n.includes('barbell')) return 'barbell';
  if (n.includes('dumbbell')) return 'dumbbell';
  if (n.includes('cable')) return 'cable';
  if (n.includes('machine')) return 'machine';
  if (n.includes('kettlebell')) return 'kettlebell';
  if (n.includes('band')) return 'band';
  return 'other';
}

function parseSetOrder(v: string): SetType {
  const t = v.trim().toUpperCase();
  if (t === 'W') return 'warmup';
  if (t === 'D') return 'drop';
  if (t === 'F') return 'failure';
  return 'normal';
}

/** "2023-01-15 08:30:00" or ISO → epoch ms (local time). */
function parseDate(v: string): number {
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)).getTime();
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
}

/** "1h 5m", "45m", "1:05:00", "3900" → ms. */
function parseDuration(v: string): number {
  const t = v.trim();
  if (!t) return 0;
  if (/^\d+$/.test(t)) return +t * 1000;
  if (t.includes(':')) return t.split(':').map(Number).reduce((a, b) => a * 60 + b, 0) * 1000;
  let ms = 0;
  const h = t.match(/(\d+)\s*h/);
  const m = t.match(/(\d+)\s*m(?!s)/);
  const s = t.match(/(\d+)\s*s/);
  if (h) ms += +h[1] * 3_600_000;
  if (m) ms += +m[1] * 60_000;
  if (s) ms += +s[1] * 1000;
  return ms;
}

function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const t = v.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export interface StrongImportResult {
  workouts: Workout[];
  newExercises: Exercise[];
  unmatched: string[];
}

/**
 * Converts a Strong app CSV export into workouts.
 * Weights are interpreted in `unit`, distances in km (kg) or miles (lb).
 */
export function importStrongCsv(text: string, unit: Unit, knownExercises: Exercise[]): StrongImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('Soubor je prázdný.');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iDate = col('date');
  const iName = col('workout name');
  const iEx = col('exercise name');
  if (iDate < 0 || iEx < 0) throw new Error('Tohle nevypadá jako export ze Strong (chybí sloupce Date / Exercise Name).');
  const iDur = col('duration');
  const iOrder = col('set order');
  const iWeight = col('weight');
  const iReps = col('reps');
  const iDist = col('distance');
  const iSec = col('seconds');
  const iNotes = col('notes');
  const iWNotes = col('workout notes');
  const iRpe = col('rpe');

  const byName = new Map(knownExercises.map((e) => [e.name.toLowerCase(), e]));
  const created = new Map<string, Exercise>();
  const unmatched = new Set<string>();

  const resolveExercise = (raw: string): string => {
    const key = raw.trim().toLowerCase();
    const mapped = STRONG_NAMES[key];
    if (mapped) return mapped;
    const known = byName.get(key);
    if (known) return known.id;
    let ex = created.get(key);
    if (!ex) {
      unmatched.add(raw.trim());
      ex = {
        id: 'strong-' + key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        name: raw.trim(),
        equipment: guessEquipment(raw),
        type: 'weight_reps' as ExerciseType,
        bodyPart: 'fullbody' as BodyPart,
        primary: [],
        secondary: [],
        custom: true,
      };
      created.set(key, ex);
    }
    return ex.id;
  };

  const toKg = (v: number | undefined) => (v === undefined ? undefined : unit === 'kg' ? v : v * KG_PER_LB);
  const toKm = (v: number | undefined) => (v === undefined ? undefined : unit === 'kg' ? v : v * 1.609344);

  const workouts = new Map<string, Workout>();
  for (const r of rows.slice(1)) {
    const dateStr = r[iDate] ?? '';
    const startedAt = parseDate(dateStr);
    if (!startedAt) continue;
    const wName = (iName >= 0 ? r[iName] : '')?.trim() || 'Trénink';
    const key = `${dateStr}|${wName}`;
    let w = workouts.get(key);
    if (!w) {
      const dur = iDur >= 0 ? parseDuration(r[iDur] ?? '') : 0;
      w = {
        id: uid(),
        name: wName,
        startedAt,
        finishedAt: startedAt + (dur || 3_600_000),
        exercises: [],
        notes: iWNotes >= 0 ? (r[iWNotes] ?? '').trim() : '',
      };
      workouts.set(key, w);
    }
    const exerciseId = resolveExercise(r[iEx] ?? '');
    const order = iOrder >= 0 ? (r[iOrder] ?? '') : '';
    // Strong exports a "Rest Timer" pseudo row with set order "Rest Timer" – skip it.
    if (/rest/i.test(order)) continue;
    let we: WorkoutExercise | undefined = w.exercises[w.exercises.length - 1];
    if (!we || we.exerciseId !== exerciseId) {
      we = { id: uid(), exerciseId, sets: [] };
      const note = iNotes >= 0 ? (r[iNotes] ?? '').trim() : '';
      if (note) we.notes = note;
      w.exercises.push(we);
    }
    const sec = num(iSec >= 0 ? r[iSec] : undefined);
    const reps = num(iReps >= 0 ? r[iReps] : undefined);
    const weight = toKg(num(iWeight >= 0 ? r[iWeight] : undefined));
    const distance = toKm(num(iDist >= 0 ? r[iDist] : undefined));
    we.sets.push({
      id: uid(),
      type: parseSetOrder(order),
      weight: weight || undefined,
      reps: reps || undefined,
      durationSec: sec || undefined,
      distance: distance || undefined,
      rpe: num(iRpe >= 0 ? r[iRpe] : undefined),
      done: true,
    });
  }

  // Infer the type of newly created exercises from the data.
  for (const ex of created.values()) {
    const sets = [...workouts.values()].flatMap((w) => w.exercises.filter((e) => e.exerciseId === ex.id).flatMap((e) => e.sets));
    const hasW = sets.some((s) => s.weight);
    const hasR = sets.some((s) => s.reps);
    const hasD = sets.some((s) => s.distance);
    const hasT = sets.some((s) => s.durationSec);
    ex.type = hasD ? 'distance_duration' : hasW ? 'weight_reps' : hasR ? 'reps_only' : hasT ? 'duration' : 'weight_reps';
    if (ex.type === 'distance_duration') ex.bodyPart = 'cardio';
  }

  return {
    workouts: [...workouts.values()].filter((w) => w.exercises.length).sort((a, b) => b.startedAt - a.startedAt),
    newExercises: [...created.values()],
    unmatched: [...unmatched],
  };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function fmtCsvDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Exports workouts in a Strong-compatible CSV layout (weights in kg, distance in km). */
export function exportCsv(workouts: Workout[], exMap: Map<string, Exercise>): string {
  const header = ['Date', 'Workout Name', 'Duration', 'Exercise Name', 'Set Order', 'Weight', 'Reps', 'Distance', 'Seconds', 'Notes', 'Workout Notes', 'RPE'];
  const lines = [header.join(',')];
  const ordered = [...workouts].sort((a, b) => a.startedAt - b.startedAt);
  for (const w of ordered) {
    const durMin = Math.round(((w.finishedAt ?? w.startedAt) - w.startedAt) / 60000);
    const dur = `${Math.floor(durMin / 60) ? Math.floor(durMin / 60) + 'h ' : ''}${durMin % 60}m`;
    for (const we of w.exercises) {
      let n = 0;
      for (const s of we.sets) {
        const order = s.type === 'warmup' ? 'W' : s.type === 'drop' ? 'D' : s.type === 'failure' ? 'F' : String(++n);
        lines.push(
          [
            fmtCsvDate(w.startedAt),
            w.name,
            dur,
            exMap.get(we.exerciseId)?.name ?? we.exerciseId,
            order,
            s.weight !== undefined ? Math.round(s.weight * 100) / 100 : '',
            s.reps ?? '',
            s.distance ?? '',
            s.durationSec ?? '',
            we.notes ?? '',
            w.notes ?? '',
            s.rpe ?? '',
          ]
            .map(csvEscape)
            .join(','),
        );
      }
    }
  }
  return lines.join('\n');
}
