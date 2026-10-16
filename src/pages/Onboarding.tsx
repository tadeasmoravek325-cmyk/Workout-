import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useStore } from '../store/store';
import { PROGRAMS } from '../data/programs';
import type { Experience, Goal, Sex, Unit } from '../types';
import { NumInput, Segmented } from '../components/ui';
import { fromDisplayWeight } from '../lib/format';
import { bigConfetti } from '../lib/celebrate';

const GOALS: { value: Goal; emoji: string; title: string; desc: string }[] = [
  { value: 'strength', emoji: '🏋️', title: 'Síla', desc: 'Zvednout co nejvíc na velkých cvicích' },
  { value: 'muscle', emoji: '💪', title: 'Svaly', desc: 'Nabrat svalovou hmotu a tvar' },
  { value: 'fitness', emoji: '⚡', title: 'Kondice', desc: 'Být fit, zdravý a plný energie' },
  { value: 'weightloss', emoji: '🔥', title: 'Hubnutí', desc: 'Spálit tuk a zpevnit postavu' },
];

const LEVELS: { value: Experience; emoji: string; title: string; desc: string }[] = [
  { value: 'beginner', emoji: '🌱', title: 'Začátečník', desc: 'Cvičím méně než půl roku' },
  { value: 'intermediate', emoji: '🌿', title: 'Mírně pokročilý', desc: '0,5–2 roky pravidelného tréninku' },
  { value: 'advanced', emoji: '🌳', title: 'Pokročilý', desc: 'Více než 2 roky, znám své maximum' },
];

const DAY_PATTERNS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function recommendProgram(exp: Experience, days: number, goal: Goal) {
  if (exp === 'beginner') return goal === 'strength' ? 'stronglifts' : 'fullbody';
  if (days >= 5) return 'ppl';
  if (days === 4) return 'upper-lower';
  return exp === 'advanced' ? 'upper-lower' : 'fullbody';
}

export default function Onboarding() {
  const update = useStore((s) => s.updateSettings);
  const addMeasurement = useStore((s) => s.addMeasurement);
  const importProgram = useStore((s) => s.importProgram);
  const setSchedule = useStore((s) => s.setSchedule);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<Goal>('muscle');
  const [exp, setExp] = useState<Experience>('beginner');
  const [days, setDays] = useState(3);
  const [sex, setSex] = useState<Sex | 'x'>('x');
  const [unit, setUnit] = useState<Unit>('kg');
  const [weight, setWeight] = useState<number | undefined>();

  const programId = recommendProgram(exp, days, goal);
  const program = PROGRAMS.find((p) => p.id === programId)!;
  const STEPS = 5;

  const finish = (withProgram: boolean) => {
    update({ name: name.trim(), goal, experience: exp, weeklyGoal: days, sex: sex === 'x' ? undefined : sex, unit, onboarded: true });
    if (weight) addMeasurement({ type: 'bodyweight', value: fromDisplayWeight(weight, unit) ?? weight, date: Date.now() });
    if (withProgram) {
      const n = importProgram(programId);
      const routines = useStore.getState().routines.slice(-n);
      DAY_PATTERNS[days].forEach((day, i) => setSchedule(day, routines[i % routines.length].id));
    }
    bigConfetti();
  };

  const next = () => setStep((s) => Math.min(STEPS, s + 1));

  return (
    <div className="onboard">
      {step > 0 && (
        <>
          <div className="row" style={{ marginBottom: 14 }}>
            <button className="icon-btn" onClick={() => setStep(step - 1)} aria-label="Zpět">
              <ArrowLeft size={20} />
            </button>
          </div>
          <div className="steps">
            {Array.from({ length: STEPS }, (_, i) => (
              <div key={i} className={i < step ? 'on' : ''} />
            ))}
          </div>
        </>
      )}

      {step === 0 && (
        <div className="grow" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="center">
            <img src="./icon-192.png" alt="" width={96} height={96} style={{ borderRadius: 28, boxShadow: 'var(--glow)' }} />
            <h1 style={{ fontSize: 36, marginTop: 20 }}>
              Vítej v <span className="grad-text">Siláku</span>!
            </h1>
            <p className="muted" style={{ fontSize: 17, marginTop: 8 }}>
              Tvůj parťák do posilovny. Zapisuj tréninky, sbírej XP a sleduj, jak sílíš.
            </p>
          </div>
          <div className="stack" style={{ marginTop: 28 }}>
            {[
              ['📝', 'Rychlé zapisování', 'Série, váhy a pauzy na pár klepnutí'],
              ['🧠', 'Chytrý trenér', 'Řekne ti, kolik dnes zvednout'],
              ['🏆', 'Úrovně a výzvy', 'Každý trénink tě posune dál'],
            ].map(([e, t, d]) => (
              <div key={t} className="row card" style={{ padding: 14 }}>
                <span style={{ fontSize: 28 }}>{e}</span>
                <div>
                  <div className="bold">{t}</div>
                  <div className="small muted">{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="grow">
          <h1>Jak ti máme říkat? 👋</h1>
          <p className="muted">Ať víme, koho povzbuzovat.</p>
          <input
            autoFocus
            className="mt-l"
            style={{ fontSize: 22, padding: 16, fontWeight: 800 }}
            placeholder="Tvoje jméno"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && next()}
          />
        </div>
      )}

      {step === 2 && (
        <div className="grow">
          <h1>Co je tvůj cíl? 🎯</h1>
          <p className="muted">Podle toho ti nastavíme opakování a doporučení.</p>
          <div className="stack mt-l">
            {GOALS.map((g) => (
              <button key={g.value} className={`choice ${goal === g.value ? 'on' : ''}`} onClick={() => setGoal(g.value)}>
                <span className="ce">{g.emoji}</span>
                <div>
                  <div className="bold">{g.title}</div>
                  <div className="small muted">{g.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grow">
          <h1>Jak dlouho cvičíš? 📈</h1>
          <div className="stack mt-l">
            {LEVELS.map((l) => (
              <button key={l.value} className={`choice ${exp === l.value ? 'on' : ''}`} onClick={() => setExp(l.value)}>
                <span className="ce">{l.emoji}</span>
                <div>
                  <div className="bold">{l.title}</div>
                  <div className="small muted">{l.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <h2 className="mt-l" style={{ marginTop: 28 }}>
            Kolikrát týdně chceš trénovat?
          </h2>
          <div className="row mt" style={{ gap: 8 }}>
            {[2, 3, 4, 5, 6].map((d) => (
              <button
                key={d}
                className={`btn grow ${days === d ? 'primary' : ''}`}
                style={{ padding: '14px 0', fontSize: 18 }}
                onClick={() => setDays(d)}
              >
                {d}×
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="grow">
          <h1>Pár údajů o tobě 📏</h1>
          <p className="muted">Pomůže to spočítat silové ranky. Vše je nepovinné a zůstává jen v telefonu.</p>
          <div className="stack mt-l">
            <div className="field">
              <label>Pohlaví</label>
              <Segmented
                value={sex}
                onChange={setSex}
                options={[
                  { value: 'm', label: 'Muž' },
                  { value: 'f', label: 'Žena' },
                  { value: 'x', label: 'Neuvádět' },
                ]}
              />
            </div>
            <div className="field">
              <label>Jednotky</label>
              <Segmented
                value={unit}
                onChange={setUnit}
                options={[
                  { value: 'kg', label: 'Kilogramy' },
                  { value: 'lb', label: 'Libry' },
                ]}
              />
            </div>
            <div className="field">
              <label>Tělesná hmotnost ({unit})</label>
              <NumInput value={weight} onChange={setWeight} placeholder={unit === 'kg' ? 'např. 75' : 'např. 165'} />
            </div>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="grow">
          <h1>{name.trim() ? `${name.trim()}, máme to!` : 'Máme to!'} 🚀</h1>
          <p className="muted">Na základě tvých odpovědí doporučujeme:</p>
          <div className="hero mt-l">
            <div className="badge white">Doporučený program</div>
            <h2 style={{ fontSize: 26, marginTop: 10 }}>{program.name}</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              {program.description}
            </div>
            <div className="row" style={{ gap: 6, marginTop: 12 }}>
              <span className="badge white">{program.level}</span>
              <span className="badge white">{program.goal}</span>
              <span className="badge white">{program.days.length} tréninky</span>
            </div>
          </div>
          <p className="small muted mt">Rutiny se přidají a rozvrhneme je do tvého týdne ({days}× týdně). Kdykoli to změníš v Plánu týdne.</p>
        </div>
      )}

      <div className="stack" style={{ marginTop: 24 }}>
        {step < STEPS ? (
          <button className="btn primary lg block" onClick={next}>
            {step === 0 ? 'Jdeme na to' : 'Pokračovat'} <ArrowRight size={20} />
          </button>
        ) : (
          <>
            <button className="btn primary lg block" onClick={() => finish(true)}>
              Přidat program a začít 💪
            </button>
            <button className="btn block" onClick={() => finish(false)}>
              Začít bez programu
            </button>
          </>
        )}
        {step === 0 && (
          <button className="btn ghost block" onClick={() => update({ onboarded: true })}>
            Přeskočit (mám data ze Strong / zálohu)
          </button>
        )}
      </div>
    </div>
  );
}
