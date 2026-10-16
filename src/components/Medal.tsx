import type { ReactNode } from 'react';
import type { Metal, Motif } from '../lib/achievements';
import './Medal.css';

/**
 * Flat, hand-drawn medal: ribbon + a body whose shape and metal follow the tier
 * (bronze circle, silver hexagon, gold shield, platinum seal) and a motif per badge family.
 * Locked medals are a dark silhouette with the motif faintly visible and a progress ring.
 */

interface MetalColors {
  rim: string;
  face: string;
  ink: string;
  stripe: string;
}

export const METALS: Record<Metal, MetalColors> = {
  bronze: { rim: '#c8814a', face: '#b06a35', ink: '#4a2309', stripe: '#c8814a' },
  silver: { rim: '#b9c3cc', face: '#9eaab5', ink: '#2f3942', stripe: '#dfe5ea' },
  gold: { rim: '#ffc23d', face: '#f0a514', ink: '#5e3a00', stripe: '#ffc23d' },
  platinum: { rim: '#62d6c8', face: '#3fbcad', ink: '#0a4640', stripe: '#a5ece3' },
};

/** Silhouette colours; the variables are set per theme in Medal.css. */
const LOCKED: MetalColors = {
  rim: 'var(--medal-lock)',
  face: 'var(--medal-lock-face)',
  ink: 'var(--medal-lock-ink)',
  stripe: 'var(--medal-lock)',
};

const CX = 50;
const CY = 60;

function polygon(points: [number, number][]): string {
  return `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}Z`;
}

function star(cx: number, cy: number, outer: number, inner: number, n: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return polygon(pts);
}

/** Outline of the medal body for a metal, centred on (cx, cy) with nominal radius r. */
function bodyPath(metal: Metal, cx: number, cy: number, r: number): string {
  switch (metal) {
    case 'bronze':
      return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
    case 'silver': {
      const R = r * 1.08;
      return polygon(Array.from({ length: 6 }, (_, i) => [cx + R * Math.cos((Math.PI / 3) * i - Math.PI / 2), cy + R * Math.sin((Math.PI / 3) * i - Math.PI / 2)]));
    }
    case 'gold': {
      const w = r * 0.98;
      const top = cy - r * 0.98;
      const shoulder = cy + r * 0.12;
      const tip = cy + r * 1.12;
      return `M${cx} ${top - r * 0.08}Q${cx + w * 0.5} ${top + r * 0.1} ${cx + w} ${top}L${cx + w} ${shoulder}Q${cx + w * 0.92} ${cy + r * 0.78} ${cx} ${tip}Q${cx - w * 0.92} ${cy + r * 0.78} ${cx - w} ${shoulder}L${cx - w} ${top}Q${cx - w * 0.5} ${top + r * 0.1} ${cx} ${top - r * 0.08}Z`;
    }
    case 'platinum':
      return star(cx, cy, r * 1.1, r * 0.93, 12);
  }
}

/* ---------------------------------------------------------------- */
/* Motifs, drawn in a 48 x 48 box. `ink` is the drawing, `cut` the face colour for holes. */
/* ---------------------------------------------------------------- */

function barbell(y: number, ink: string): ReactNode {
  return (
    <g fill={ink}>
      <rect x={2} y={y - 2} width={44} height={4} rx={2} />
      <rect x={8} y={y - 12} width={5.5} height={24} rx={2} />
      <rect x={34.5} y={y - 12} width={5.5} height={24} rx={2} />
      <rect x={3.5} y={y - 8} width={4.5} height={16} rx={1.8} />
      <rect x={40} y={y - 8} width={4.5} height={16} rx={1.8} />
    </g>
  );
}

function motifShape(motif: Motif, ink: string, cut: string): ReactNode {
  const round = { strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (motif) {
    case 'flag':
      return (
        <g fill={ink}>
          <rect x={11} y={5} width={5} height={39} rx={2.5} />
          <path d="M16 7H39L33.5 16.5L39 26H16Z" />
        </g>
      );
    case 'dumbbell':
      return (
        <g fill={ink}>
          <rect x={11} y={21} width={26} height={6} rx={2} />
          <rect x={7} y={11} width={8} height={26} rx={3} />
          <rect x={33} y={11} width={8} height={26} rx={3} />
          <rect x={1.5} y={16} width={6.5} height={16} rx={2.5} />
          <rect x={40} y={16} width={6.5} height={16} rx={2.5} />
        </g>
      );
    case 'flame':
      return (
        <g>
          <path
            fill={ink}
            d="M25 2C27 11 38 16 38 29C38 37.5 31.7 44 24 44C16.3 44 10 37.5 10 29C10 22.5 13 18 17.5 14.5C17.5 20 19.5 23 22.5 24.5C20.5 16 22 8 25 2Z"
          />
          <path fill={cut} d="M24.5 26C27.5 30.5 31 32.5 31 36.5C31 40.2 28 43 24 43C20 43 17 40.2 17 36.5C17 32.5 21 30.5 24.5 26Z" />
        </g>
      );
    case 'trophy':
      return (
        <g>
          <path {...round} stroke={ink} strokeWidth={4} d="M13 10.5H7.5C7.5 18 10 22 15 23.5M35 10.5H40.5C40.5 18 38 22 33 23.5" />
          <g fill={ink}>
            <path d="M12 5H36V17C36 24.5 30.6 30 24 30C17.4 30 12 24.5 12 17Z" />
            <rect x={21} y={28} width={6} height={8} />
            <rect x={13} y={35} width={22} height={7} rx={2.5} />
          </g>
          <path fill={cut} d="M24 10.5L25.9 14.4L30.2 15L27.1 18L27.8 22.3L24 20.3L20.2 22.3L20.9 18L17.8 15L22.1 14.4Z" />
        </g>
      );
    case 'kettlebell':
      return (
        <g>
          <path {...round} stroke={ink} strokeWidth={5.5} d="M15.5 22V15C15.5 9.5 19.3 6 24 6C28.7 6 32.5 9.5 32.5 15V22" />
          <path fill={ink} d="M9 30.5C9 22 15.7 16.5 24 16.5C32.3 16.5 39 22 39 30.5C39 36 36.6 40.2 33 43H15C11.4 40.2 9 36 9 30.5Z" />
          <rect x={17} y={26} width={14} height={4.5} rx={2.25} fill={cut} />
        </g>
      );
    case 'clock':
      return (
        <g>
          <rect x={19.5} y={1} width={9} height={5} rx={2} fill={ink} />
          <circle cx={24} cy={26} r={18} fill={ink} />
          <path {...round} stroke={cut} strokeWidth={4.5} d="M24 14V26L31.5 31" />
          <circle cx={24} cy={26} r={3} fill={cut} />
        </g>
      );
    case 'tally':
      return (
        <g>
          <g fill={ink}>
            <rect x={8} y={7} width={5} height={34} rx={2.5} />
            <rect x={17} y={7} width={5} height={34} rx={2.5} />
            <rect x={26} y={7} width={5} height={34} rx={2.5} />
            <rect x={35} y={7} width={5} height={34} rx={2.5} />
          </g>
          <path {...round} stroke={cut} strokeWidth={10} d="M4 34L44 14" />
          <path {...round} stroke={ink} strokeWidth={5} d="M4 34L44 14" />
        </g>
      );
    case 'sunrise':
      return (
        <g>
          <path fill={ink} d="M10 33A14 14 0 0 1 38 33Z" />
          <path {...round} stroke={ink} strokeWidth={4.5} d="M24 5V11M8.5 13.5L12.5 17.5M39.5 13.5L35.5 17.5M2.5 27H7M41 27H45.5" />
          <rect x={3} y={35} width={42} height={5} rx={2.5} fill={ink} />
          <rect x={13} y={42} width={22} height={4} rx={2} fill={ink} />
        </g>
      );
    case 'moon':
      return (
        <g fill={ink}>
          <path d="M27 5A19 19 0 1 0 44 30A15 15 0 0 1 27 5Z" />
          <path d="M37 4.5L38.8 9.2L43.5 11L38.8 12.8L37 17.5L35.2 12.8L30.5 11L35.2 9.2Z" />
        </g>
      );
    case 'hourglass':
      return (
        <g>
          <path {...round} stroke={ink} strokeWidth={4} d="M14 9C14 17 19.5 21 22.5 24C19.5 27 14 31 14 39M34 9C34 17 28.5 21 25.5 24C28.5 27 34 31 34 39" />
          <rect x={8} y={3} width={32} height={6} rx={2.5} fill={ink} />
          <rect x={8} y={39} width={32} height={6} rx={2.5} fill={ink} />
          <path fill={ink} d="M18.5 13.5H29.5C28.5 17 26.5 19 24 21C21.5 19 19.5 17 18.5 13.5Z" />
          <path fill={ink} d="M16.5 37.5C17 32.5 20.5 30.5 24 28.5C27.5 30.5 31 32.5 31.5 37.5Z" />
        </g>
      );
    case 'squat':
      return (
        <g>
          {barbell(14, ink)}
          <path {...round} stroke={ink} strokeWidth={5.5} d="M14 31L24 41L34 31" />
        </g>
      );
    case 'deadlift':
      return (
        <g>
          <path {...round} stroke={ink} strokeWidth={5.5} d="M14 17L24 7L34 17" />
          {barbell(34, ink)}
        </g>
      );
    case 'bench':
      return (
        <g>
          {barbell(14, ink)}
          <g fill={ink}>
            <rect x={6} y={32} width={36} height={5} rx={2.5} />
            <rect x={10} y={35} width={5} height={10} rx={2} />
            <rect x={33} y={35} width={5} height={10} rx={2} />
          </g>
        </g>
      );
    case 'pullup':
      return (
        <g>
          <g fill={ink}>
            <rect x={3} y={4} width={42} height={5} rx={2.5} />
            <circle cx={24} cy={20} r={6} />
            <path d="M12.5 46C12.5 35 17 29 24 29C31 29 35.5 35 35.5 46Z" />
          </g>
          <path {...round} stroke={ink} strokeWidth={4.5} d="M14 36L11 7M34 36L37 7" />
        </g>
      );
    case 'variety':
      return (
        <g fill={ink}>
          <circle cx={13.5} cy={13.5} r={9.5} />
          <rect x={26} y={4} width={18} height={18} rx={4} />
          <path d="M13.5 26L23.5 44H3.5Z" />
          <path d="M35 25L45 35L35 45L25 35Z" />
        </g>
      );
    case 'ruler':
      return (
        <g transform="rotate(-38 24 24)">
          <rect x={1} y={15} width={46} height={18} rx={3.5} fill={ink} />
          <g fill={cut}>
            {[7, 13, 19, 25, 31, 37].map((x, i) => (
              <rect key={x} x={x} y={15} width={3} height={i % 2 ? 7 : 10} rx={1} />
            ))}
          </g>
        </g>
      );
  }
}

export interface MedalProps {
  motif: Motif;
  metal: Metal;
  /** Rendered as a dark silhouette. */
  locked?: boolean;
  /** 0..1, drawn as a ring around a locked medal. */
  progress?: number;
  /** Pixel width and height, 40 to 120 works well. */
  size?: number;
  /** Accessible name; the medal is decorative without it. */
  label?: string;
  /** Plays a short pop-in when the medal appears. */
  pop?: boolean;
  className?: string;
}

export function Medal({ motif, metal, locked, progress, size = 64, label, pop, className }: MedalProps) {
  const c = locked ? LOCKED : METALS[metal];
  const r = locked ? 27 : 31;
  const faceR = r * 0.78;
  const s = r * 1.16;
  const showRing = locked && progress !== undefined;
  const ringR = 38;
  const circ = 2 * Math.PI * ringR;
  const p = Math.max(0, Math.min(1, progress ?? 0));
  const ribbonA = locked ? 'var(--medal-lock)' : 'var(--accent)';
  const ribbonB = locked ? 'var(--medal-lock-back)' : 'color-mix(in srgb, var(--accent) 72%, #000)';
  const classes = ['medal', locked ? 'medal--locked' : `medal--${metal}`, pop ? 'medal--pop' : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* Ribbon: two crossed straps, darker one behind. */}
      <g className="medal-ribbon">
        <path d="M80 2H60L40 44H60Z" fill={ribbonB} />
        <path d="M70 2H66L46 44H50Z" fill={c.stripe} opacity={locked ? 0 : 0.9} />
        <path d="M20 2H40L60 44H40Z" fill={ribbonA} />
        <path d="M30 2H34L54 44H50Z" fill={c.stripe} opacity={locked ? 0 : 0.9} />
      </g>
      {showRing && (
        <g>
          <circle cx={CX} cy={CY} r={ringR} fill="none" stroke="var(--medal-lock)" strokeWidth={6} />
          {p > 0 && (
            <circle
              className="medal-ring"
              cx={CX}
              cy={CY}
              r={ringR}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={`${Math.max(p * circ, 0.01)} ${circ}`}
              transform={`rotate(-90 ${CX} ${CY})`}
            />
          )}
        </g>
      )}
      <g className="medal-body">
        <path d={bodyPath(metal, CX, CY, r)} fill={c.rim} stroke={c.rim} strokeWidth={4} strokeLinejoin="round" />
        <path d={bodyPath(metal, CX, CY, faceR)} fill={c.face} stroke={c.face} strokeWidth={2} strokeLinejoin="round" />
        <g transform={`translate(${CX - s / 2} ${CY - s / 2 + (metal === 'gold' ? -1 : 0)}) scale(${s / 48})`}>{motifShape(motif, c.ink, c.face)}</g>
      </g>
    </svg>
  );
}
