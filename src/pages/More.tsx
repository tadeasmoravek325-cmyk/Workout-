import { Link } from 'react-router-dom';
import { CalendarRange, ChartColumn, ClipboardList, Medal, Ruler, Settings, User, Wrench, ChevronRight } from 'lucide-react';

const ITEMS = [
  { to: '/profile', icon: User, title: 'Můj profil', desc: 'Level, XP, silové ranky a aktivita' },
  { to: '/stats', icon: ChartColumn, title: 'Statistiky', desc: 'Objem na svaly, týdenní přehled, velká trojka' },
  { to: '/measure', icon: Ruler, title: 'Měření těla', desc: 'Hmotnost, tuk, obvody a jejich vývoj' },
  { to: '/planner', icon: CalendarRange, title: 'Plán týdne', desc: 'Přiřaď rutiny ke dnům v týdnu' },
  { to: '/achievements', icon: Medal, title: 'Odznaky', desc: 'Úspěchy a milníky' },
  { to: '/tools', icon: Wrench, title: 'Nástroje', desc: 'Kalkulačka kotoučů, 1RM, rozcvička' },
  { to: '/train', icon: ClipboardList, title: 'Rutiny a programy', desc: 'Vlastní rutiny a hotové programy' },
  { to: '/settings', icon: Settings, title: 'Nastavení', desc: 'Jednotky, pauzy, import ze Strong, záloha' },
];

export default function More() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Více</h1>
      </div>
      <div className="list">
        {ITEMS.map((i) => (
          <Link key={i.to} to={i.to} className="list-item">
            <div className="avatar">
              <i.icon size={19} />
            </div>
            <div className="grow">
              <div className="bold">{i.title}</div>
              <div className="small muted">{i.desc}</div>
            </div>
            <ChevronRight size={18} className="muted" />
          </Link>
        ))}
      </div>
      <div className="center tiny muted mt-l">Gym · data jsou uložená jen v tomto zařízení</div>
    </div>
  );
}
