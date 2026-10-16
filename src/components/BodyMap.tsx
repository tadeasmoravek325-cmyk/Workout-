import type { Muscle } from '../types';
import { MUSCLE_LABELS } from '../data/exercises';

type Shape =
  | { k: 'e'; cx: number; cy: number; rx: number; ry: number }
  | { k: 'r'; x: number; y: number; w: number; h: number; r?: number }
  | { k: 'p'; d: string };

const e = (cx: number, cy: number, rx: number, ry: number): Shape => ({ k: 'e', cx, cy, rx, ry });
const r = (x: number, y: number, w: number, h: number, rr = 4): Shape => ({ k: 'r', x, y, w, h, r: rr });
const p = (d: string): Shape => ({ k: 'p', d });

const FRONT: [Muscle, Shape[]][] = [
  ['shoulders', [e(31, 47, 8, 7), e(69, 47, 8, 7)]],
  ['chest', [r(37, 42, 12.5, 17, 5), r(50.5, 42, 12.5, 17, 5)]],
  ['biceps', [e(25, 66, 5, 11), e(75, 66, 5, 11)]],
  ['forearms', [e(20, 91, 4.5, 12), e(80, 91, 4.5, 12)]],
  ['abs', [r(41, 61, 18, 33, 5)]],
  ['quads', [e(42, 124, 8, 22), e(58, 124, 8, 22)]],
  ['calves', [e(41.5, 170, 5, 15), e(58.5, 170, 5, 15)]],
];

const BACK: [Muscle, Shape[]][] = [
  ['traps', [p('M138 33 L162 33 L171 45 L156 52 L144 52 L129 45 Z')]],
  ['rearDelts', [e(129, 48, 7, 7), e(171, 48, 7, 7)]],
  ['lats', [p('M135 54 L148 54 L148 82 L139 78 Z'), p('M165 54 L152 54 L152 82 L161 78 Z')]],
  ['triceps', [e(124, 66, 5, 11), e(176, 66, 5, 11)]],
  ['forearms', [e(120, 91, 4.5, 12), e(180, 91, 4.5, 12)]],
  ['lowerBack', [r(141, 82, 18, 14, 4)]],
  ['glutes', [e(142, 107, 9, 10), e(158, 107, 9, 10)]],
  ['hamstrings', [e(142, 134, 8, 19), e(158, 134, 8, 19)]],
  ['calves', [e(141.5, 170, 6, 15), e(158.5, 170, 6, 15)]],
];

function Silhouette({ x }: { x: number }) {
  return (
    <g fill="var(--card-2)" opacity={0.55}>
      <circle cx={x} cy={18} r={10} />
      <rect x={x - 4} y={27} width={8} height={8} rx={2} />
      <rect x={x - 21} y={38} width={42} height={64} rx={14} />
      <rect x={x - 17} y={98} width={34} height={20} rx={8} />
      <rect x={x - 33} y={42} width={10} height={64} rx={5} />
      <rect x={x + 23} y={42} width={10} height={64} rx={5} />
      <rect x={x - 17} y={110} width={15} height={78} rx={7} />
      <rect x={x + 2} y={110} width={15} height={78} rx={7} />
    </g>
  );
}

function draw(shape: Shape, fill: string, key: string, title: string) {
  const common = { fill, stroke: 'var(--bg)', strokeWidth: 0.8, key };
  const t = <title>{title}</title>;
  if (shape.k === 'e') return <ellipse {...common} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry}>{t}</ellipse>;
  if (shape.k === 'r') return <rect {...common} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r}>{t}</rect>;
  return <path {...common} d={shape.d}>{t}</path>;
}

/** Front/back body silhouette with muscles colored by `color(muscle)`. */
export function BodyMap({ color, height = 260 }: { color: (m: Muscle) => string; height?: number }) {
  const render = (groups: [Muscle, Shape[]][]) =>
    groups.flatMap(([m, shapes]) => shapes.map((s, i) => draw(s, color(m), `${m}-${i}`, MUSCLE_LABELS[m])));
  return (
    <svg viewBox="0 0 200 200" style={{ width: '100%', height, display: 'block' }} role="img" aria-label="Mapa svalů">
      <Silhouette x={50} />
      <Silhouette x={150} />
      {render(FRONT)}
      {render(BACK)}
      <text x={50} y={198} textAnchor="middle" fontSize={8} fill="var(--muted)">
        Zepředu
      </text>
      <text x={150} y={198} textAnchor="middle" fontSize={8} fill="var(--muted)">
        Zezadu
      </text>
    </svg>
  );
}

/** Interpolates between two hex colors. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

export function volumeColor(sets: number): string {
  if (!sets) return '#3a4150';
  if (sets < 10) return mix('#5a3a2a', '#ff6b35', Math.min(1, sets / 10));
  if (sets <= 20) return '#2ecc71';
  return '#a77bff';
}

export function recoveryColor(v: number | undefined): string {
  if (v === undefined) return '#3a4150';
  if (v < 0.5) return mix('#ff4d5e', '#f1c40f', v * 2);
  return mix('#f1c40f', '#2ecc71', (v - 0.5) * 2);
}
