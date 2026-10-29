import { useState } from 'react';
import { Droplet, Ruler, Scale, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../store/store';
import type { MeasurementType, Unit } from '../types';
import { fmtDate, fmtNum, fromDisplayWeight, toDisplayWeight } from '../lib/format';
import { NumInput, Sheet, toast, undoToast, BackLabel } from '../components/ui';
import { t } from '../i18n';

export const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  bodyweight: 'Bodyweight',
  bodyfat: 'Body fat',
  neck: 'Neck',
  shoulders: 'Shoulders',
  chest: 'Chest',
  waist: 'Waist',
  hips: 'Hips',
  bicepsL: 'Biceps (left)',
  bicepsR: 'Biceps (right)',
  forearm: 'Forearm',
  thighL: 'Thigh (left)',
  thighR: 'Thigh (right)',
  calf: 'Calf',
};

const ICONS: Partial<Record<MeasurementType, typeof Ruler>> = { bodyweight: Scale, bodyfat: Droplet };

function unitOf(t: MeasurementType, unit: Unit) {
  return t === 'bodyweight' ? unit : t === 'bodyfat' ? '%' : 'cm';
}

function toDisplay(t: MeasurementType, v: number, unit: Unit) {
  return t === 'bodyweight' ? (toDisplayWeight(v, unit) ?? v) : v;
}

function toDate(ts: number) {
  const d = new Date(ts);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default function Measure() {
  const measurements = useStore((s) => s.measurements);
  const unit = useStore((s) => s.settings.unit);
  const add = useStore((s) => s.addMeasurement);
  const del = useStore((s) => s.deleteMeasurement);
  const navigate = useNavigate();
  const [open, setOpen] = useState<MeasurementType | null>(null);
  const [value, setValue] = useState<number | undefined>();
  const [date, setDate] = useState(toDate(Date.now()));

  const byType = (t: MeasurementType) => measurements.filter((m) => m.type === t);
  const types = Object.keys(MEASUREMENT_LABELS) as MeasurementType[];

  const save = () => {
    if (!open || value === undefined) return;
    const v = open === 'bodyweight' ? (fromDisplayWeight(value, unit) ?? value) : value;
    const [y, mo, d] = date.split('-').map(Number);
    const ts = new Date(y, mo - 1, d, 12).getTime();
    add({ type: open, value: v, date: ts });
    setValue(undefined);
    toast(t('Saved'));
  };

  const list = open ? byType(open) : [];
  const chartData = list.map((m) => ({ date: m.date, value: toDisplay(m.type, m.value, unit) }));

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          <BackLabel />
        </button>
      </div>
      <h1 style={{ marginBottom: 14 }}>{t('Body measurements')}</h1>
      <div className="list">
        {types.map((mt) => {
          const items = byType(mt);
          const last = items[items.length - 1];
          const first = items[0];
          const diff = last && first && items.length > 1 ? toDisplay(mt, last.value, unit) - toDisplay(mt, first.value, unit) : 0;
          return (
            <button key={mt} className="list-item" onClick={() => setOpen(mt)}>
              <div className="avatar">{(() => {
                const I = ICONS[mt] ?? Ruler;
                return <I size={19} />;
              })()}</div>
              <div className="grow">
                <div className="bold">{MEASUREMENT_LABELS[mt]}</div>
                <div className="small muted">{last ? fmtDate(last.date) : t('No entries yet')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="bold">{last ? `${fmtNum(toDisplay(mt, last.value, unit))} ${unitOf(mt, unit)}` : '–'}</div>
                {diff !== 0 && (
                  <div className="tiny muted">
                    {diff > 0 ? '+' : ''}
                    {t('{diff} since start', { diff: fmtNum(diff) })}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {open && (
        <Sheet title={MEASUREMENT_LABELS[open]} onClose={() => setOpen(null)}>
          <div className="card">
            <div className="grid-2">
              <div className="field">
                <label>{t('Value ({unit})', { unit: unitOf(open, unit) })}</label>
                <NumInput value={value} onChange={setValue} placeholder="0" />
              </div>
              <div className="field">
                <label>{t('Date')}</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <button className="btn primary block mt" onClick={save} disabled={value === undefined}>
              {t('Add entry')}
            </button>
          </div>
          {chartData.length > 1 && (
            <div className="card mt" style={{ height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(t) => fmtDate(t, { day: 'numeric', month: 'numeric' })}
                    stroke="var(--line)"
                  />
                  <YAxis domain={['auto', 'auto']} stroke="var(--line)" />
                  <Tooltip
                    contentStyle={{ background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 10 }}
                    labelFormatter={(t) => fmtDate(Number(t))}
                    formatter={(v) => [`${fmtNum(Number(v))} ${unitOf(open, unit)}`, MEASUREMENT_LABELS[open]]}
                  />
                  <Line dataKey="value" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--accent)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="list mt">
            {[...list].reverse().map((m) => (
              <div key={m.id} className="list-item">
                <span className="grow">{fmtDate(m.date)}</span>
                <span className="bold">
                  {fmtNum(toDisplay(m.type, m.value, unit))} {unitOf(m.type, unit)}
                </span>
                <button
                  className="del-set"
                  onClick={() => {
                    del(m.id);
                    undoToast(t('Entry deleted'), () => useStore.getState().restoreMeasurement(m));
                  }}
                  aria-label={t('Delete')}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}
