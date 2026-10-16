import { DIVISIONS, type LeagueInfo } from '../lib/gamification';
import { t, tn } from '../i18n';
import { CountUp } from './CountUp';

const DAY = 86_400_000;

/** Shield with one chevron per division step. Flat colours, no gradients. */
export function DivisionBadge({ division, size = 56, muted = false }: { division: number; size?: number; muted?: boolean }) {
  const d = DIVISIONS[division];
  const fill = muted ? 'var(--card-2)' : d.color;
  const chevrons = Math.min(division + 1, 5);
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 100 115" role="img" aria-label={t('{name} league', { name: t(d.name) })}>
      <path d="M50 4 L92 18 V58 C92 84 74 101 50 111 C26 101 8 84 8 58 V18 Z" fill={fill} />
      <path d="M50 14 L82 25 V58 C82 78 68 92 50 100 C32 92 18 78 18 58 V25 Z" fill="rgba(0,0,0,0.18)" />
      {division === DIVISIONS.length - 1 ? (
        <path d="M30 70 L34 42 L44 54 L50 36 L56 54 L66 42 L70 70 Z" fill="#fff" />
      ) : (
        Array.from({ length: chevrons }, (_, i) => {
          const y = 76 - i * 11 - (5 - chevrons) * 4;
          return <path key={i} d={`M32 ${y} L50 ${y - 10} L68 ${y} L68 ${y + 6} L50 ${y - 4} L32 ${y + 6} Z`} fill="#fff" opacity={0.95} />;
        })
      )}
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
  const d = DIVISIONS[league.division];
  const top = league.division === DIVISIONS.length - 1;
  const scale = top ? Math.max(league.keepAt * 2, league.weekXp) : Math.max(league.promoteAt, league.weekXp);
  const daysLeft = Math.max(1, Math.ceil((league.endsAt - Date.now()) / DAY));
  const status = leagueStatus(league);
  return (
    <div className="card league-card">
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
    </div>
  );
}
