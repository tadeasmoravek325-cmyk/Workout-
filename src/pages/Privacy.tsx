import { useNavigate } from 'react-router-dom';
import { t } from '../i18n';

/**
 * Plain-language privacy notice. It describes what the app actually does; it is a starting point
 * and should be reviewed (operator details, legal basis) before a public launch.
 */
export default function Privacy() {
  const navigate = useNavigate();
  const sections: [string, string][] = [
    [
      t('What we store'),
      t('Your workouts, routines, custom exercises, measurements, settings and notes. If you add them: name, sex, birth year and bodyweight, used only for strength ranks.'),
    ],
    [
      t('Where'),
      t('Always on your phone. If you sign in, also in our cloud database hosted in the EU, so you can restore it and use more devices. Without an account nothing leaves your phone.'),
    ],
    [t('Why'), t('Only to run the app for you: logging, stats, backup and sync. No ads, no selling of data, no tracking across apps.')],
    [t('Who can see it'), t('Only you. Every row in the database belongs to your account and the database refuses access to anyone else.')],
    [
      t('Your rights'),
      t('Export everything any time (Settings, Back up now). Delete your account and all cloud data with one tap (Settings, Delete account). Delete data on this phone in Settings too.'),
    ],
    [t('Sign-in providers'), t('If you sign in with Apple or Google, we only receive your email address and an account ID from them.')],
  ];
  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          ‹ {t('Back')}
        </button>
      </div>
      <h1>{t('Privacy')}</h1>
      <div className="stack mt">
        {sections.map(([h, p]) => (
          <div key={h} className="card">
            <h3>{h}</h3>
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              {p}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
