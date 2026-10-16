import type { Muscle, Sex } from '../types';
import { MUSCLE_LABELS } from '../data/exercises';
import { ANATOMY, type AnatomyRegion, type AnatomyView } from '../data/anatomy';
import { useStore } from '../store/store';
import { t } from '../i18n';

/** Fill for muscles with no data. Theme-aware, defined in index.css. */
export const IDLE = 'var(--muscle-idle)';

interface Props {
  /** Fill for a muscle. Return IDLE for muscles with nothing to show. */
  color: (m: Muscle) => string;
  /**
   * Ranks muscles that share one drawn region (the deltoid shows front or rear plus side delts).
   * The muscle with the highest value is drawn. Defaults to the first muscle of the region.
   */
  value?: (m: Muscle) => number;
  height?: number;
  /** Body model. Defaults to the profile setting, male when unset. */
  sex?: Sex;
  /** Show only one side, for small thumbnails. */
  side?: 'front' | 'back';
  onPick?: (m: Muscle) => void;
  labels?: boolean;
}

function pick(region: AnatomyRegion, value?: (m: Muscle) => number): Muscle | null {
  if (!region.m) return null;
  if (!value || region.m.length === 1) return region.m[0];
  return region.m.reduce((best, m) => (value(m) > value(best) ? m : best), region.m[0]);
}

function View({ view, color, value, onPick }: { view: AnatomyView } & Pick<Props, 'color' | 'value' | 'onPick'>) {
  return (
    <svg viewBox={view.viewBox} className="body-view" role="presentation">
      {view.regions.map((r, i) => {
        const m = pick(r, value);
        const fill = m ? color(m) : 'var(--body-skin)';
        return (
          <g
            key={i}
            fill={fill}
            className={m && onPick ? 'muscle tappable' : m ? 'muscle' : undefined}
            onClick={m && onPick ? () => onPick(m) : undefined}
          >
            {m && <title>{MUSCLE_LABELS[m]}</title>}
            {r.d.map((d, j) => (
              <path key={j} d={d} />
            ))}
          </g>
        );
      })}
      <path d={view.outline} fill="none" stroke="var(--body-outline)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * Anatomical front/back figure, male or female, with muscles coloured by `color(muscle)`.
 * Artwork from react-muscle-highlighter (MIT), see src/data/anatomy.ts.
 */
export function BodyMap({ color, value, height = 260, sex, side, onPick, labels = true }: Props) {
  const profileSex = useStore((s) => s.settings.sex);
  const updateSettings = useStore((s) => s.updateSettings);
  const model = ANATOMY[(sex ?? profileSex) === 'f' ? 'female' : 'male'];
  const sides = side ? [side] : (['front', 'back'] as const);
  // Only full-size maps ask; thumbnails just use the default body.
  const ask = !sex && !profileSex && labels && !side;
  return (
    <>
      <div className={`body-map ${labels ? '' : 'no-labels'}`} style={{ height }} role="img" aria-label={t('Muscle map')}>
        {sides.map((s) => (
          <figure key={s}>
            <View view={model[s]} color={color} value={value} onPick={onPick} />
            {labels && <figcaption>{s === 'front' ? t('Front') : t('Back')}</figcaption>}
          </figure>
        ))}
      </div>
      {ask && (
        <div className="body-sex">
          <span className="small muted">{t('Show body as')}</span>
          <button className="chip" onClick={() => updateSettings({ sex: 'm' })}>
            {t('Male')}
          </button>
          <button className="chip" onClick={() => updateSettings({ sex: 'f' })}>
            {t('Female')}
          </button>
        </div>
      )}
    </>
  );
}

/** Interpolates between two hex colors. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

/** Involvement of a muscle in one exercise (0..1) → colour. */
export function loadColor(load: number | undefined): string {
  if (!load) return IDLE;
  return mix('#5a2a10', '#ff7a1a', Math.min(1, load));
}

/** Muscle form: untrained muscles stay grey, trained ones glow brighter the fresher their form. */
export function formColor(level: number, form: number): string {
  if (!level) return IDLE;
  return mix('#4a2a18', '#ff7a1a', Math.max(0.08, Math.min(1, form)));
}

export const RECOVERY_COLORS = { tired: '#b3200f', recovering: '#ff7a1a', ready: '#ffd29a' };

/** Weekly fractional sets → colour. 10–20 is the productive zone for most people. */
export function volumeColor(sets: number): string {
  if (sets < 0.25) return IDLE;
  if (sets < 10) return mix('#5a2a10', '#ff7a1a', Math.min(1, sets / 10));
  if (sets <= 20) return '#ffa030';
  return '#ff4433';
}

export function recoveryColor(v: number | undefined): string {
  if (v === undefined) return IDLE;
  if (v < 0.5) return mix(RECOVERY_COLORS.tired, RECOVERY_COLORS.recovering, v * 2);
  return mix(RECOVERY_COLORS.recovering, RECOVERY_COLORS.ready, (v - 0.5) * 2);
}
