import { Link } from 'react-router-dom';
import { CalendarRange, ChartColumn, ClipboardList, Medal, Ruler, Settings, User, Wrench, ChevronRight } from 'lucide-react';
import { t } from '../i18n';

const ITEMS = [
  { to: '/profile', icon: User, title: 'My profile', desc: 'Level, XP, strength ranks and activity' },
  { to: '/stats', icon: ChartColumn, title: 'Stats', desc: 'Volume per muscle, weekly overview, big 3' },
  { to: '/measure', icon: Ruler, title: 'Body measurements', desc: 'Weight, body fat, circumferences and trends' },
  { to: '/planner', icon: CalendarRange, title: 'Weekly plan', desc: 'Assign routines to days of the week' },
  { to: '/achievements', icon: Medal, title: 'Badges', desc: 'Achievements and milestones' },
  { to: '/tools', icon: Wrench, title: 'Tools', desc: 'Plate calculator, 1RM, warm-up' },
  { to: '/train', icon: ClipboardList, title: 'Routines and programs', desc: 'Your own routines and ready-made programs' },
  { to: '/settings', icon: Settings, title: 'Settings', desc: 'Units, rest timers, Strong import, backup' },
];

export default function More() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('More')}</h1>
      </div>
      <div className="list">
        {ITEMS.map((i) => (
          <Link key={i.to} to={i.to} className="list-item">
            <div className="avatar">
              <i.icon size={19} />
            </div>
            <div className="grow">
              <div className="bold">{t(i.title)}</div>
              <div className="small muted">{t(i.desc)}</div>
            </div>
            <ChevronRight size={18} className="muted" />
          </Link>
        ))}
      </div>
      <div className="center tiny muted mt-l">Gym · {t('your data is stored only on this device')}</div>
    </div>
  );
}
