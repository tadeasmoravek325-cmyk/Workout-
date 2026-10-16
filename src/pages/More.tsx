import { Link } from 'react-router-dom';

const ITEMS = [
  { to: '/profile', icon: '🦾', title: 'Můj profil', desc: 'Level, XP, silové ranky a aktivita' },
  { to: '/stats', icon: '📊', title: 'Statistiky', desc: 'Objem na svaly, týdenní přehled, velká trojka' },
  { to: '/measure', icon: '📏', title: 'Měření těla', desc: 'Hmotnost, tuk, obvody a jejich vývoj' },
  { to: '/planner', icon: '🗓️', title: 'Plán týdne', desc: 'Přiřaď rutiny ke dnům v týdnu' },
  { to: '/achievements', icon: '🏅', title: 'Odznaky', desc: 'Úspěchy a milníky' },
  { to: '/tools', icon: '🧮', title: 'Nástroje', desc: 'Kalkulačka kotoučů, 1RM, rozcvička' },
  { to: '/train', icon: '📋', title: 'Rutiny a programy', desc: 'Vlastní rutiny a hotové programy' },
  { to: '/settings', icon: '⚙️', title: 'Nastavení', desc: 'Jednotky, pauzy, import ze Strong, záloha' },
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
            <div className="avatar" style={{ fontSize: 20 }}>
              {i.icon}
            </div>
            <div className="grow">
              <div className="bold">{i.title}</div>
              <div className="small muted">{i.desc}</div>
            </div>
            <span className="chev" />
          </Link>
        ))}
      </div>
      <div className="center tiny muted mt-l">Setsmith · Ukuj si sílu · data jsou uložená jen v tomto zařízení</div>
    </div>
  );
}
