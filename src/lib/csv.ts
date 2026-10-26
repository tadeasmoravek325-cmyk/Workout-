import type { BodyPart, Equipment, Exercise, ExerciseType, SetType, Unit, Workout, WorkoutExercise } from '../types';
import { uid } from './calc';
import { KG_PER_LB } from './format';
import { withSuggestedMuscles } from './suggestMuscles';
import { t } from '../i18n';

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

/** Normalized exercise name used for matching: lower case, single spaces. */
export function strongKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Short stable hash (FNV-1a) so two different names can never share an id. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function strongExerciseId(name: string): string {
  const key = strongKey(name);
  const slug = key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `strong-${slug || 'exercise'}-${hash(key)}`;
}

interface HeaderInfo {
  index: Record<string, number>;
  weightUnit?: Unit;
  distanceUnit?: 'km' | 'mi' | 'm';
}

/** Maps header cells like "Weight (kg)" or "Duration (sec)" to base names and units. */
function readHeader(cells: string[]): HeaderInfo {
  const index: Record<string, number> = {};
  let weightUnit: Unit | undefined;
  let distanceUnit: HeaderInfo['distanceUnit'];
  cells.forEach((raw, i) => {
    const m = raw.trim().toLowerCase().match(/^([^(]+?)\s*(?:\(([^)]*)\))?$/);
    if (!m) return;
    const base = m[1].trim();
    const unit = (m[2] ?? '').trim();
    if (!(base in index)) index[base] = i;
    if (base === 'weight') {
      if (/^kg/.test(unit)) weightUnit = 'kg';
      else if (/^lb/.test(unit)) weightUnit = 'lb';
    }
    if (base === 'distance') {
      if (unit === 'km') distanceUnit = 'km';
      else if (/^mi/.test(unit)) distanceUnit = 'mi';
      else if (/^m(eters?)?$/.test(unit)) distanceUnit = 'm';
    }
  });
  return { index, weightUnit, distanceUnit };
}

export interface StrongExerciseSummary {
  /** Name exactly as written in the export (first occurrence). */
  name: string;
  key: string;
  sets: number;
  /** Suggested target: an existing exercise id, or null for "create a new exercise". */
  suggested: string | null;
}

export interface StrongAnalysis {
  rows: string[][];
  header: HeaderInfo;
  exercises: StrongExerciseSummary[];
  workoutCount: number;
  /** Unit found in the header ("Weight (kg)"), if any. */
  unitFromFile?: Unit;
}

/**
 * First step of an import: reads the file and proposes how each Strong exercise maps to the library.
 * Only exact name matches are suggested; everything else becomes its own new exercise.
 */
export function analyzeStrongCsv(text: string, knownExercises: Exercise[]): StrongAnalysis {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error(t('The file is empty.'));
  const header = readHeader(rows[0]);
  const iDate = header.index['date'];
  const iEx = header.index['exercise name'];
  if (iDate === undefined || iEx === undefined) {
    throw new Error(t("This doesn't look like a Strong export (the Date and Exercise Name columns are missing)."));
  }
  const iName = header.index['workout name'];
  const iOrder = header.index['set order'];
  const byName = new Map(knownExercises.map((e) => [strongKey(e.name), e.id]));
  const summaries = new Map<string, StrongExerciseSummary>();
  const workouts = new Set<string>();
  for (const r of rows.slice(1)) {
    const name = (r[iEx] ?? '').trim();
    if (!name || !parseDate(r[iDate] ?? '')) continue;
    if (iOrder !== undefined && /rest/i.test(r[iOrder] ?? '')) continue;
    workouts.add(`${r[iDate]}|${iName !== undefined ? r[iName] : ''}`);
    const key = strongKey(name);
    let s = summaries.get(key);
    if (!s) {
      s = { name, key, sets: 0, suggested: STRONG_NAMES[key] ?? byName.get(key) ?? null };
      summaries.set(key, s);
    }
    s.sets++;
  }
  return {
    rows,
    header,
    exercises: [...summaries.values()].sort((a, b) => b.sets - a.sets),
    workoutCount: workouts.size,
    unitFromFile: header.weightUnit,
  };
}

export interface StrongImportResult {
  workouts: Workout[];
  newExercises: Exercise[];
  unmatched: string[];
}

/**
 * Second step: builds workouts using the confirmed mapping (Strong name key → exercise id, or null for new).
 * Weights are read in the unit from the file header when present, otherwise in `unit`.
 */
export function buildStrongImport(
  analysis: StrongAnalysis,
  mapping: Record<string, string | null>,
  unit: Unit,
  knownExercises: Exercise[],
): StrongImportResult {
  const { rows, header } = analysis;
  const col = (n: string) => header.index[n] ?? -1;
  const iDate = col('date');
  const iName = col('workout name');
  const iEx = col('exercise name');
  const iDur = col('duration');
  const iOrder = col('set order');
  const iWeight = col('weight');
  const iReps = col('reps');
  const iDist = col('distance');
  const iSec = col('seconds');
  const iNotes = col('notes');
  const iWNotes = col('workout notes');
  const iRpe = col('rpe');

  const weightUnit = header.weightUnit ?? unit;
  const toKg = (v: number | undefined) => (v === undefined ? undefined : weightUnit === 'kg' ? v : v * KG_PER_LB);
  const distUnit = header.distanceUnit ?? (unit === 'kg' ? 'km' : 'mi');
  const toKm = (v: number | undefined) =>
    v === undefined ? undefined : distUnit === 'km' ? v : distUnit === 'mi' ? v * 1.609344 : v / 1000;

  const known = new Set(knownExercises.map((e) => e.id));
  const created = new Map<string, Exercise>();
  const resolve = (raw: string): string => {
    const key = strongKey(raw);
    const target = mapping[key];
    if (target && known.has(target)) return target;
    let ex = created.get(key);
    if (!ex) {
      const id = strongExerciseId(raw);
      ex = {
        id,
        name: raw.trim(),
        equipment: guessEquipment(raw),
        type: 'weight_reps' as ExerciseType,
        bodyPart: 'fullbody' as BodyPart,
        primary: [],
        secondary: [],
        custom: true,
      };
      ex = { ...withSuggestedMuscles(ex, knownExercises), equipment: ex.equipment };
      created.set(key, ex);
    }
    return ex.id;
  };

  const workouts = new Map<string, Workout>();
  for (const r of rows.slice(1)) {
    const dateStr = r[iDate] ?? '';
    const startedAt = parseDate(dateStr);
    const exName = (r[iEx] ?? '').trim();
    if (!startedAt || !exName) continue;
    const order = iOrder >= 0 ? (r[iOrder] ?? '') : '';
    // Strong exports a "Rest Timer" pseudo row – skip it.
    if (/rest/i.test(order)) continue;
    const wName = (iName >= 0 ? r[iName] : '')?.trim() || 'Workout';
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
    const exerciseId = resolve(exName);
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
    unmatched: [...created.values()].map((e) => e.name),
  };
}

/** One-step import with the suggested mapping (used by tests and simple callers). */
export function importStrongCsv(text: string, unit: Unit, knownExercises: Exercise[]): StrongImportResult {
  const analysis = analyzeStrongCsv(text, knownExercises);
  const mapping = Object.fromEntries(analysis.exercises.map((e) => [e.key, e.suggested]));
  return buildStrongImport(analysis, mapping, unit, knownExercises);
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
