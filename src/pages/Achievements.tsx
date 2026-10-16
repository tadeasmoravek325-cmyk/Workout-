import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useExerciseMap, useStore } from '../store/store';
import {
  ACHIEVEMENTS,
  achievementStats,
  allFamilyStatus,
  tierDates,
  type FamilyGroup,
  type FamilyStatus,
  type Metal,
} from '../lib/achievements';
import { Medal, METALS } from '../components/Medal';
import { Sheet } from '../components/ui';
import { fmtDate } from '../lib/format';
import { t } from '../i18n';

const GROUPS: { id: FamilyGroup; title: string }[] = [
  { id: 'consistency', title: 'Consistency' },
  { id: 'strength', title: 'Strength' },
  { id: 'habits', title: 'Habits' },
];

const METAL_ORDER: Metal[] = ['bronze', 'silver', 'gold', 'platinum'];
const METAL_NAMES: Record<Metal, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };

/** The medal that represents a family right now: highest tier reached, or the first tier locked. */
function FamilyMedal({ st, size, pop }: { st: FamilyStatus; size: number; pop?: boolean }) {
  const a = st.current ?? st.tiers[0];
  return (
    <Medal
      motif={st.family.motif}
      metal={a.metal}
      locked={!st.current}
      progress={st.current ? undefined : st.progress}
      size={size}
      pop={pop}
      label={st.current ? st.current.title : t('{name}, locked', { name: t(st.family.name) })}
    />
  );
}

function Pips({ st }: { st: FamilyStatus }) {
  if (st.tiers.length < 2) return null;
  return (
    <div className="medal-pips" aria-hidden>
      {st.tiers.map((a, i) => (
        <i key={a.id} style={i <= st.reached ? { background: METALS[a.metal].rim } : undefined} />
      ))}
    </div>
  );
}

export default function Achievements() {
  const workouts = useStore((s) => s.workouts);
  const measurements = useStore((s) => s.measurements);
  const exMap = useExerciseMap();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const stats = useMemo(() => achievementStats(workouts, exMap, measurements), [workouts, exMap, measurements]);
  const statuses = useMemo(() => allFamilyStatus(stats), [stats]);

  const earned = statuses.flatMap((s) => s.tiers.slice(0, s.reached + 1));
  const total = ACHIEVEMENTS.length;
  const byMetal = METAL_ORDER.map((m) => ({ m, n: earned.filter((a) => a.metal === m).length }));
  const open = statuses.find((s) => s.family.id === openId);

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          ‹ {t('Back')}
        </button>
      </div>
      <h1>{t('Badges')}</h1>

      <div className="medal-hero">
        <div className="medal-hero-num">
          <span>{earned.length}</span>
          <small>/ {total}</small>
        </div>
        <div className="medal-hero-sub">{t('medals earned')}</div>
        <div className="medal-hero-bar">
          <div style={{ width: `${(earned.length / total) * 100}%` }} />
        </div>
        <div className="medal-hero-metals">
          {byMetal.map(({ m, n }) => (
            <span key={m} className="medal-hero-chip" title={t(METAL_NAMES[m])} aria-label={`${t(METAL_NAMES[m])}: ${n}`}>
              <i style={{ background: METALS[m].rim }} />
              {n}
            </span>
          ))}
        </div>
      </div>

      {GROUPS.map((g) => (
        <div key={g.id} className="section">
          <div className="section-title">
            <h2>{t(g.title)}</h2>
          </div>
          <div className="medal-grid">
            {statuses
              .filter((s) => s.family.group === g.id)
              .map((st) => {
                const done = !st.next;
                return (
                  <button key={st.family.id} className={`medal-tile ${st.current ? '' : 'locked'}`} onClick={() => setOpenId(st.family.id)}>
                    <FamilyMedal st={st} size={76} />
                    <div className="medal-tile-name">{t(st.family.name)}</div>
                    <Pips st={st} />
                    <div className="medal-tile-progress">{done ? (st.tiers.length > 1 ? t('All tiers done') : t('Earned')) : st.label}</div>
                    {!done && st.current && (
                      <div className="medal-bar sm">
                        <div style={{ width: `${st.progress * 100}%` }} />
                      </div>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      ))}

      {open && <FamilySheet st={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function FamilySheet({ st, onClose }: { st: FamilyStatus; onClose: () => void }) {
  const workouts = useStore((s) => s.workouts);
  const measurements = useStore((s) => s.measurements);
  const exMap = useExerciseMap();
  const dates = useMemo(() => tierDates(st.family, workouts, exMap, measurements), [st.family, workouts, exMap, measurements]);
  const { current, next } = st;

  return (
    <Sheet title={t(st.family.name)} onClose={onClose}>
      <div className="medal-sheet-hero">
        <FamilyMedal st={st} size={128} pop />
        <div className="medal-sheet-title">{current ? current.title : t('Not earned yet')}</div>
        <div className="small muted">
          {current
            ? st.tiers.length > 1
              ? t('{metal} · tier {n} of {total}', { metal: t(METAL_NAMES[current.metal]), n: st.reached + 1, total: st.tiers.length })
              : t(METAL_NAMES[current.metal])
            : st.tiers[0].description}
        </div>
      </div>

      {next ? (
        <div className="medal-next">
          <div className="row between">
            <span className="bold">{t('Next: {title}', { title: next.title })}</span>
            <span className="medal-next-pct">{Math.floor(st.progress * 100)}%</span>
          </div>
          <div className="medal-bar">
            <div style={{ width: `${st.progress * 100}%` }} />
          </div>
          <div className="small muted">{st.label}</div>
        </div>
      ) : (
        <div className="medal-next done">
          <Check size={20} strokeWidth={3} />
          <span className="bold">{st.tiers.length > 1 ? t('Every tier earned. Legendary.') : t('Earned')}</span>
        </div>
      )}

      <div className="list mt">
        {st.tiers.map((a, i) => {
          const reached = i <= st.reached;
          return (
            <div key={a.id} className="list-item medal-tier">
              <Medal motif={a.motif} metal={a.metal} locked={!reached} size={48} />
              <div className="grow">
                <div className="bold">{a.title}</div>
                <div className="small muted">{a.description}</div>
              </div>
              <div className="medal-tier-when">
                {reached ? (dates[i] ? fmtDate(dates[i], { day: 'numeric', month: 'short', year: 'numeric' }) : t('Earned')) : '–'}
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
