import { useState } from 'react';
import { useStore } from '../store/store';
import { e1rm, plateCalc, roundTo } from '../lib/calc';
import { fmtNum, fromDisplayWeight, KG_PER_LB, toDisplayWeight } from '../lib/format';
import { NumInput } from './ui';
import { PlateVisual } from './PlateVisual';
import { t, tn } from '../i18n';

const PERCENTAGES = [100, 95, 90, 85, 80, 75, 70, 65, 60, 50];

/** 1RM and percentage table for one exercise, prefilled from the user's best estimated max. */
export function OneRmCalculator({ bestKg }: { bestKg: number }) {
  const unit = useStore((s) => s.settings.unit);
  const step = unit === 'kg' ? 2.5 : 5;
  const [max, setMax] = useState<number | undefined>(bestKg ? roundTo(toDisplayWeight(bestKg, unit) ?? 0, 0.5) : undefined);
  const [weight, setWeight] = useState<number | undefined>();
  const [reps, setReps] = useState<number | undefined>();

  const fromSet = (w?: number, r?: number) => {
    if (w && r) setMax(roundTo(e1rm(w, r), 0.5));
  };

  return (
    <div className="card">
      <div className="bold">{t('1RM and percentages')}</div>
      <div className="small muted">{t('Starts from your best estimate. Enter a set to work it out.')}</div>
      <div className="row mt" style={{ gap: 8, alignItems: 'flex-end' }}>
        <div className="field grow" style={{ margin: 0 }}>
          <label>{t('Weight ({unit})', { unit })}</label>
          <NumInput
            value={weight}
            onChange={(v) => {
              setWeight(v);
              fromSet(v, reps);
            }}
          />
        </div>
        <span className="muted" style={{ paddingBottom: 14 }}>
          ×
        </span>
        <div className="field grow" style={{ margin: 0 }}>
          <label>{t('Reps')}</label>
          <NumInput
            value={reps}
            onChange={(v) => {
              const r = v === undefined ? undefined : Math.round(v);
              setReps(r);
              fromSet(weight, r);
            }}
          />
        </div>
        <span className="muted" style={{ paddingBottom: 14 }}>
          =
        </span>
        <div className="field grow" style={{ margin: 0 }}>
          <label>1RM</label>
          <NumInput value={max} onChange={setMax} />
        </div>
      </div>
      {!!max && (
        <div className="list mt">
          {PERCENTAGES.map((pct) => (
            <div key={pct} className="list-item">
              <span style={{ width: 60 }} className="bold">
                {pct} %
              </span>
              <span className="grow">
                {fmtNum(roundTo(max * (pct / 100), step))} {unit}
              </span>
              <span className="muted small">
                {tn(pct === 100 ? 1 : Math.max(1, Math.round(30 * (100 / pct - 1))), '≈ {n} rep', '≈ {n} reps')}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="tiny muted mt">{t('Epley formula. Estimates get less reliable above 10 reps.')}</div>
    </div>
  );
}

/** Which plates to load for a target weight, using the bar and plates from Settings. */
export function PlateCalculator({ initialKg }: { initialKg?: number }) {
  const settings = useStore((s) => s.settings);
  const unit = settings.unit;
  const [target, setTarget] = useState<number | undefined>(
    initialKg ? roundTo(toDisplayWeight(initialKg, unit) ?? 0, unit === 'kg' ? 2.5 : 5) : unit === 'kg' ? 60 : 135,
  );
  const plates = unit === 'kg' ? settings.plates : [45, 35, 25, 10, 5, 2.5].map((p) => p * KG_PER_LB);
  const res = plateCalc(fromDisplayWeight(target, unit) ?? 0, settings.barWeightKg, plates);
  const perSide = res.perSide.map((p) => Math.round((toDisplayWeight(p, unit) ?? 0) * 100) / 100);

  return (
    <div className="card">
      <div className="row between">
        <div>
          <div className="bold">{t('Plate calculator')}</div>
          <div className="small muted">{t('Bar {weight}', { weight: `${fmtNum(toDisplayWeight(settings.barWeightKg, unit))} ${unit}` })}</div>
        </div>
        <div className="field" style={{ margin: 0, width: 110 }}>
          <NumInput value={target} onChange={setTarget} ariaLabel={t('Target weight ({unit})', { unit })} />
        </div>
      </div>
      <PlateVisual plates={perSide} />
      <div className="center">
        <div className="small muted">{t('Per side')}</div>
        <div className="bold" style={{ fontSize: 18 }}>
          {perSide.length ? perSide.map((p) => fmtNum(p, 2)).join(' + ') : t('Just the bar')}
        </div>
        {res.remainder > 0.01 && (
          <div className="small" style={{ color: 'var(--warn)', marginTop: 6 }}>
            {t('Closest possible: {achieved} ({missing} short)', {
              achieved: `${fmtNum(toDisplayWeight(res.achieved, unit))} ${unit}`,
              missing: `${fmtNum(toDisplayWeight(res.remainder, unit))} ${unit}`,
            })}
          </div>
        )}
      </div>
    </div>
  );
}
