import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { e1rm, plateCalc, roundTo, warmupSets, weightForReps } from '../lib/calc';
import { fmtNum, fromDisplayWeight, KG_PER_LB, toDisplayWeight } from '../lib/format';
import { NumInput, Segmented } from '../components/ui';
import { PlateVisual } from '../components/PlateVisual';

export default function Tools() {
  const settings = useStore((s) => s.settings);
  const navigate = useNavigate();
  const unit = settings.unit;
  const [tab, setTab] = useState<'plates' | '1rm' | 'warmup'>('plates');
  const [target, setTarget] = useState<number | undefined>(unit === 'kg' ? 100 : 225);
  const [weight, setWeight] = useState<number | undefined>(unit === 'kg' ? 80 : 185);
  const [reps, setReps] = useState<number | undefined>(5);
  const [bar, setBar] = useState<number | undefined>(toDisplayWeight(settings.barWeightKg, unit));

  const targetKg = fromDisplayWeight(target, unit) ?? 0;
  const barKg = fromDisplayWeight(bar, unit) ?? 20;
  const plates = unit === 'kg' ? settings.plates : [45, 35, 25, 10, 5, 2.5].map((p) => p * KG_PER_LB);
  const res = plateCalc(targetKg, barKg, plates);
  const perSideDisplay = res.perSide.map((p) => Math.round((toDisplayWeight(p, unit) ?? 0) * 100) / 100);

  const oneRm = e1rm(fromDisplayWeight(weight, unit) ?? 0, reps ?? 0);
  const step = unit === 'kg' ? 2.5 : 5;

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          ‹ Zpět
        </button>
      </div>
      <h1 style={{ marginBottom: 14 }}>Nástroje</h1>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'plates', label: 'Kotouče' },
          { value: '1rm', label: '1RM' },
          { value: 'warmup', label: 'Rozcvička' },
        ]}
      />

      {tab === 'plates' && (
        <div className="card mt">
          <div className="grid-2">
            <div className="field">
              <label>Cílová váha ({unit})</label>
              <NumInput value={target} onChange={setTarget} />
            </div>
            <div className="field">
              <label>Osa ({unit})</label>
              <NumInput value={bar} onChange={setBar} />
            </div>
          </div>
          <PlateVisual plates={perSideDisplay} />
          <div className="center">
            <div className="small muted">Na každou stranu</div>
            <div className="bold" style={{ fontSize: 18 }}>
              {perSideDisplay.length ? perSideDisplay.map((p) => fmtNum(p, 2)).join(' + ') : 'Jen osa'}
            </div>
            {res.remainder > 0.01 && (
              <div className="small" style={{ color: 'var(--warn)', marginTop: 6 }}>
                Nejbližší možná váha: {fmtNum(toDisplayWeight(res.achieved, unit))} {unit} (chybí {fmtNum(toDisplayWeight(res.remainder, unit))} {unit})
              </div>
            )}
          </div>
          <div className="tiny muted center mt">Dostupné kotouče nastavíš v Nastavení.</div>
        </div>
      )}

      {tab === '1rm' && (
        <>
          <div className="card mt">
            <div className="grid-2">
              <div className="field">
                <label>Váha ({unit})</label>
                <NumInput value={weight} onChange={setWeight} />
              </div>
              <div className="field">
                <label>Opakování</label>
                <NumInput value={reps} onChange={(v) => setReps(v === undefined ? undefined : Math.round(v))} />
              </div>
            </div>
            <div className="center mt-l">
              <div className="small muted">Odhadované maximum (1RM)</div>
              <div className="num-xl accent">
                {oneRm ? `${fmtNum(toDisplayWeight(oneRm, unit))} ${unit}` : '–'}
              </div>
            </div>
          </div>
          {oneRm > 0 && (
            <div className="list mt">
              <div className="list-item small muted bold">
                <span style={{ width: 60 }}>%</span>
                <span className="grow">Váha</span>
                <span>Opakování</span>
              </div>
              {[100, 95, 90, 85, 80, 75, 70, 65, 60, 50].map((pct) => {
                const w = roundTo((toDisplayWeight(oneRm, unit) ?? 0) * (pct / 100), step);
                const r = Math.max(1, Math.round(30 * (100 / pct - 1)));
                return (
                  <div key={pct} className="list-item">
                    <span style={{ width: 60 }} className="bold">
                      {pct} %
                    </span>
                    <span className="grow">
                      {fmtNum(w)} {unit}
                    </span>
                    <span className="muted">≈ {pct === 100 ? 1 : r}</span>
                  </div>
                );
              })}
            </div>
          )}
          {oneRm > 0 && (
            <div className="tiny muted mt">
              Výpočet podle Epleyho vzorce. Např. na 8 opakování zvládneš asi{' '}
              {fmtNum(roundTo(toDisplayWeight(weightForReps(oneRm, 8), unit) ?? 0, step))} {unit}.
            </div>
          )}
        </>
      )}

      {tab === 'warmup' && (
        <div className="card mt">
          <div className="field">
            <label>Pracovní váha ({unit})</label>
            <NumInput value={target} onChange={setTarget} />
          </div>
          <div className="list mt">
            {warmupSets(targetKg, barKg, unit === 'kg' ? 2.5 : 5 * KG_PER_LB).map((s, i) => (
              <div key={i} className="list-item">
                <span className="badge gold">W{i + 1}</span>
                <span className="grow bold">
                  {fmtNum(toDisplayWeight(s.weight, unit))} {unit} × {s.reps}
                </span>
                <span className="small muted">
                  {plateCalc(s.weight, barKg, plates)
                    .perSide.map((p) => fmtNum(toDisplayWeight(p, unit), 2))
                    .join('+') || 'osa'}
                </span>
              </div>
            ))}
            <div className="list-item">
              <span className="badge accent">Práce</span>
              <span className="grow bold">
                {fmtNum(target)} {unit}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
