import { useState } from 'react';
import { DIVISIONS, keepXp, promoteXp, type LeagueInfo } from '../lib/gamification';
import { useStore } from '../store/store';
import { Sheet } from './ui';
import { t, tn } from '../i18n';
import { CountUp } from './CountUp';

const DAY = 86_400_000;

/**
 * Division emblem: a shield in the division colour. Metals show one to five chevrons, gems a cut
 * stone with one to four facets lines, Champion a crown. Flat colours, no gradients.
 */
export function DivisionBadge({ division, size = 56, muted = false }: { division: number; size?: number; muted?: boolean }) {
  const d = DIVISIONS[division];
  const fill = muted ? 'var(--card-2)' : d.color;
  const ink = muted ? 'var(--muted)' : d.ink;
  const metals = DIVISIONS.filter((x) => x.kind === 'metal').length;
  let emblem;
  if (d.kind === 'crown') {
    emblem = <path d="M28 74 L32 40 L43 54 L50 32 L57 54 L68 40 L72 74 Z M28 80 H72 V86 H28 Z" fill={ink} />;
  } else if (d.kind === 'gem') {
    const rank = division - metals + 1;
    emblem = (
      <g fill="none" stroke={ink} strokeWidth={4} strokeLinejoin="round">
        <path d="M32 46 L40 34 H60 L68 46 L50 80 Z" fill={ink} fillOpacity={0.18} />
        <path d="M32 46 H68" />
        {rank >= 2 && <path d="M40 34 L46 46 L50 80" />}
        {rank >= 3 && <path d="M60 34 L54 46 L50 80" />}
        {rank >= 4 && <path d="M46 46 L50 34 L54 46" />}
      </g>
    );
  } else {
    const chevrons = division + 1;
    emblem = Array.from({ length: chevrons }, (_, i) => {
      const y = 80 - i * 10 - (5 - chevrons) * 5;
      return <path key={i} d={`M32 ${y} L50 ${y - 10} L68 ${y} L68 ${y + 6} L50 ${y - 4} L32 ${y + 6} Z`} fill={ink} />;
    });
  }
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 100 115" role="img" aria-label={t('{name} league', { name: t(d.name) })}>
      <path d="M50 4 L92 18 V58 C92 84 74 101 50 111 C26 101 8 84 8 58 V18 Z" fill={fill} />
      <path d="M50 14 L82 25 V58 C82 78 68 92 50 100 C32 92 18 78 18 58 V25 Z" fill="rgba(0,0,0,0.12)" />
      {emblem}
    </svg>
  );
}

export function leagueStatus(l: LeagueInfo): { text: string; tone: 'up' | 'safe' | 'danger' } {
  const top = l.division === DIVISIONS.length - 1;
  if (!top && l.weekXp >= l.promoteAt) return { text: t('Promotion secured. Keep going for the bonus.'), tone: 'up' };
  if (l.weekXp < l.keepAt) return { text: t('Drop zone: {n} XP to stay in {name}', { n: l.keepAt - l.weekXp, name: t(DIVISIONS[l.division].name) }), tone: 'danger' };
  if (top) return { text: t('Top league. Stay above {n} XP to keep it.', { n: l.keepAt }), tone: 'safe' };
  return { text: t('{n} XP to move up to {name}', { n: l.promoteAt - l.weekXp, name: t(DIVISIONS[l.division + 1].name) }), tone: 'safe' };
}

/** The current league week: division, weekly XP against the keep and promotion lines, time left. */
export function LeagueCard({ league }: { league: LeagueInfo }) {
  const [ladder, setLadder] = useState(false);
  const d = DIVISIONS[league.division];
  const top = league.division === DIVISIONS.length - 1;
  const scale = top ? Math.max(league.keepAt * 2, league.weekXp) : Math.max(league.promoteAt, league.weekXp);
  const daysLeft = Math.max(1, Math.ceil((league.endsAt - Date.now()) / DAY));
  const status = leagueStatus(league);
  return (
    <>
    <button type="button" className="card league-card tap" onClick={() => setLadder(true)} aria-label={t('Show all leagues')}>
      <div className="row" style={{ gap: 14 }}>
        <DivisionBadge division={league.division} size={52} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row between">
            <h3 style={{ color: d.color }}>{t('{name} league', { name: t(d.name) })}</h3>
            <span className="small muted">{tn(daysLeft, '{n} day left', '{n} days left')}</span>
          </div>
          <div className="num-l tabular">
            <CountUp value={league.weekXp} /> <span className="small muted">{t('XP this week')}</span>
          </div>
        </div>
      </div>
      <div className="league-track" aria-hidden="true">
        <div className="fill" style={{ width: `${Math.min(1, league.weekXp / scale) * 100}%`, background: d.color }} />
        {league.keepAt > 0 && <div className="mark keep" style={{ left: `${(league.keepAt / scale) * 100}%` }} />}
        {!top && <div className="mark up" style={{ left: '100%' }} />}
      </div>
      <div className={`small bold league-status ${status.tone}`}>{status.text}</div>
    </button>
    {ladder && <LeagueLadder league={league} onClose={() => setLadder(false)} />}
    </>
  );
}

/** All divisions from Champion down, with the lines that apply this week at the user's goal. */
function LeagueLadder({ league, onClose }: { league: LeagueInfo; onClose: () => void }) {
  const goal = useStore((s) => s.settings.weeklyGoal);
  return (
    <Sheet title={t('Leagues')} onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        {t('Every Monday the week is scored. Reach the promotion line to move up a league, fall under the keep line and you drop one. The lines follow your weekly goal ({n} workouts).', { n: goal })}
      </p>
      <div className="list">
        {DIVISIONS.map((_, i) => DIVISIONS.length - 1 - i).map((i) => {
          const d = DIVISIONS[i];
          const here = i === league.division;
          const locked = i > league.division;
          return (
            <div key={d.id} className={`list-item ladder-row ${here ? 'here' : ''}`}>
              <DivisionBadge division={i} size={34} muted={locked} />
              <div className="grow">
                <div className="bold" style={{ color: locked ? undefined : d.color }}>
                  {t(d.name)} {here && <span className="badge accent">{t('You')}</span>}
                </div>
                <div className="small muted">
                  {i < DIVISIONS.length - 1 ? t('Up at {n} XP', { n: promoteXp(i, goal) }) : t('The top')}
                  {i > 0 && ` · ${t('stay above {n}', { n: keepXp(i, goal) })}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}