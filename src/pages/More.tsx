import { Link } from 'react-router-dom';
import { ChartColumn, ChevronRight, FileSpreadsheet, Ruler, Settings } from 'lucide-react';
import { useExerciseMap, useStore } from '../store/store';
import { saveCsvFile } from '../lib/backup';
import { t } from '../i18n';

const ITEMS = [
  { to: '/stats', icon: ChartColumn, title: 'Stats', desc: 'Volume per muscle, weekly overview, big 3' },
  { to: '/measure', icon: Ruler, title: 'Body measurements', desc: 'Weight, body fat, circumferences and trends' },
  { to: '/settings', icon: Settings, title: 'Settings', desc: 'Units, rest timers, Strong import, backup' },
];

export default function More() {
  const exMap = useExerciseMap();
  const hasWorkouts = useStore((s) => s.workouts.length > 0);
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
        <button className="list-item" onClick={() => void saveCsvFile(exMap)} disabled={!hasWorkouts}>
          <div className="avatar">
            <FileSpreadsheet size={19} />
          </div>
          <div className="grow">
            <div className="bold">{t('Export workouts (CSV)')}</div>
            <div className="small muted">{t('For Excel or Google Sheets, same format as Strong')}</div>
          </div>
        </button>
      </div>
      <div className="center tiny muted mt-l">Gym · {t('your data is saved on this device')}</div>
    </div>
  );
}
