import { useState } from 'react';
import { ArrowLeft, ArrowRight, BicepsFlexed, Dumbbell, Flame, HeartPulse, Mountain, NotebookPen, Sprout, TrendingUp, Trophy } from 'lucide-react';
import { useStore } from '../store/store';
import { PROGRAMS } from '../data/programs';
import type { Experience, Goal, Sex, Unit } from '../types';
import { NumInput, Segmented } from '../components/ui';
import { fromDisplayWeight } from '../lib/format';
import { cloudConfigured, useCloud } from '../lib/cloud';
import { SignInSheet } from '../components/Account';
import { t, tn } from '../i18n';

const GOALS: { value: Goal; icon: typeof Dumbbell; title: string; desc: string }[] = [
  { value: 'strength', icon: Dumbbell, title: 'Strength', desc: 'Lift as much as you can on the big lifts' },
  { value: 'muscle', icon: BicepsFlexed, title: 'Muscle', desc: 'Build muscle and shape' },
  { value: 'fitness', icon: HeartPulse, title: 'Fitness', desc: 'Feel fit, healthy and full of energy' },
  { value: 'weightloss', icon: Flame, title: 'Weight loss', desc: 'Burn fat and tone up' },
];

const LEVELS: { value: Experience; icon: typeof Dumbbell; title: string; desc: string }[] = [
  { value: 'beginner', icon: Sprout, title: 'Beginner', desc: "I've trained for less than 6 months" },
  { value: 'intermediate', icon: TrendingUp, title: 'Intermediate', desc: '6 months to 2 years of regular training' },
  { value: 'advanced', icon: Mountain, title: 'Advanced', desc: 'Over 2 years, I know my maxes' },
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
  const [signIn, setSignIn] = useState(false);
  const cloudUser = useCloud((s) => s.user);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState<Goal>('muscle');
  const [exp, setExp] = useState<Experience>('beginner');
  const [days, setDays] = useState(3);
  const [sex, setSex] = useState<Sex | 'x'>('x');
  const [unit, setUnit] = useState<Unit>('kg');
  const [weight, setWeight] = useState<number | undefined>();
  const [birthYear, setBirthYear] = useState<number | undefined>();

  const programId = recommendProgram(exp, days, goal);
  const program = PROGRAMS.find((p) => p.id === programId)!;
  const STEPS = 5;

  const finish = (withProgram: boolean) => {
    update({ name: name.trim(), goal, experience: exp, weeklyGoal: days, sex: sex === 'x' ? undefined : sex, unit, onboarded: true,
      birthYear: birthYear && birthYear > 1920 && birthYear <= new Date().getFullYear() - 10 ? Math.round(birthYear) : undefined });
    if (weight) addMeasurement({ type: 'bodyweight', value: fromDisplayWeight(weight, unit) ?? weight, date: Date.now() });
    if (withProgram) {
      const n = importProgram(programId);
      const routines = useStore.getState().routines.slice(-n);
      DAY_PATTERNS[days].forEach((day, i) => setSchedule(day, routines[i % routines.length].id));
    }
  };

  const next = () => setStep((s) => Math.min(STEPS, s + 1));

  return (
    <div className="onboard">
      {step > 0 && (
        <>
          <div className="row" style={{ marginBottom: 14 }}>
            <button className="icon-btn" onClick={() => setStep(step - 1)} aria-label={t('Back')}>
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
            <img src="./icon-192.png" alt="" width={96} height={96} style={{ borderRadius: 22 }} />
            <h1 style={{ fontSize: 36, marginTop: 20 }}>
              {t('Welcome to')} <span className="grad-text">Gym</span>
            </h1>
            <p className="muted" style={{ fontSize: 17, marginTop: 8 }}>
              {t('Your gym buddy. Log workouts and watch yourself get stronger.')}
            </p>
          </div>
          <div className="stack" style={{ marginTop: 28 }}>
            {[
              [NotebookPen, 'Fast logging', 'Sets, weights and rest in a few taps'],
              [TrendingUp, 'Smart coach', 'Suggests what to lift today'],
              [Trophy, 'PRs and progress', 'See yourself get stronger, workout by workout'],
            ].map(([I, title, desc]) => (
              <div key={title as string} className="row card" style={{ padding: 14 }}>
                <span className="ce">{(() => { const C = I as typeof Trophy; return <C size={22} />; })()}</span>
                <div>
                  <div className="bold">{t(title as string)}</div>
                  <div className="small muted">{t(desc as string)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="grow">
          <h1>{t('What should we call you?')}</h1>
          <p className="muted">{t('So we know who to cheer on.')}</p>
          <input
            autoFocus
            className="mt-l"
            style={{ fontSize: 22, padding: 16, fontWeight: 700 }}
            placeholder={t('Your name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && next()}
          />
        </div>
      )}

      {step === 2 && (
        <div className="grow">
          <h1>{t("What's your goal?")}</h1>
          <p className="muted">{t("We'll tune your reps and tips to match.")}</p>
          <div className="stack mt-l">
            {GOALS.map((g) => (
              <button key={g.value} className={`choice ${goal === g.value ? 'on' : ''}`} onClick={() => setGoal(g.value)}>
                <span className="ce">
                  <g.icon size={24} />
                </span>
                <div>
                  <div className="bold">{t(g.title)}</div>
                  <div className="small muted">{t(g.desc)}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grow">
          <h1>{t('How long have you been training?')}</h1>
          <div className="stack mt-l">
            {LEVELS.map((l) => (
              <button key={l.value} className={`choice ${exp === l.value ? 'on' : ''}`} onClick={() => setExp(l.value)}>
                <span className="ce">
                  <l.icon size={24} />
                </span>
                <div>
                  <div className="bold">{t(l.title)}</div>
                  <div className="small muted">{t(l.desc)}</div>
                </div>
              </button>
            ))}
          </div>
          <h2 className="mt-l" style={{ marginTop: 28 }}>
            {t('How many times a week do you want to train?')}
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
          <h1>{t('A bit about you')}</h1>
          <p className="muted">{t('Everything is optional and stays on your phone.')}</p>
          <div className="stack mt-l">
            <div className="field">
              <label>{t('Gender')}</label>
              <Segmented
                value={sex}
                onChange={setSex}
                options={[
                  { value: 'm', label: t('Male') },
                  { value: 'f', label: t('Female') },
                  { value: 'x', label: t('Rather not say') },
                ]}
              />
            </div>
            <div className="field">
              <label>{t('Units')}</label>
              <Segmented
                value={unit}
                onChange={setUnit}
                options={[
                  { value: 'kg', label: t('Kilograms') },
                  { value: 'lb', label: t('Pounds') },
                ]}
              />
            </div>
            <div className="field">
              <label>{t('Birth year')}</label>
              <NumInput value={birthYear} onChange={setBirthYear} placeholder={t('e.g. 1995')} />
            </div>
            <div className="field">
              <label>{t('Bodyweight ({unit})', { unit })}</label>
              <NumInput value={weight} onChange={setWeight} placeholder={unit === 'kg' ? t('e.g. 75') : t('e.g. 165')} />
            </div>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="grow">
          <h1>{name.trim() ? t("{name}, you're all set", { name: name.trim() }) : t("You're all set")}</h1>
          <p className="muted">{t('Based on your answers, we recommend:')}</p>
          <div className="hero mt-l">
            <div className="badge white">{t('Recommended program')}</div>
            <h2 style={{ fontSize: 26, marginTop: 10 }}>{program.name}</h2>
            <div className="muted" style={{ marginTop: 6 }}>
              {program.description}
            </div>
            <div className="row" style={{ gap: 6, marginTop: 12 }}>
              <span className="badge white">{program.level}</span>
              <span className="badge white">{program.goal}</span>
              <span className="badge white">{tn(program.days.length, '{n} workout', '{n} workouts')}</span>
            </div>
          </div>
          <p className="small muted mt">
            {t("We'll add the routines and spread them across your week ({days}× a week). You can change this anytime in the weekly plan.", { days })}
          </p>
        </div>
      )}

      <div className="stack" style={{ marginTop: 24 }}>
        {step < STEPS ? (
          <button className="btn primary lg block" onClick={next}>
            {step === 0 ? t("Let's go") : t('Continue')} <ArrowRight size={20} />
          </button>
        ) : (
          <>
            <button className="btn primary lg block" onClick={() => finish(true)}>
              {t('Add program and start')}
            </button>
            <button className="btn block" onClick={() => finish(false)}>
              {t('Start without a program')}
            </button>
          </>
        )}
        {step === 0 && cloudConfigured && !cloudUser && (
          <button className="btn block" onClick={() => setSignIn(true)}>
            {t('I already have an account')}
          </button>
        )}
        {step === 0 && (
          <button className="btn ghost block" onClick={() => update({ onboarded: true })}>
            {t('Skip (I have Strong data or a backup)')}
          </button>
        )}
      </div>
      {signIn && <SignInSheet onClose={() => setSignIn(false)} />}
    </div>
  );
}
