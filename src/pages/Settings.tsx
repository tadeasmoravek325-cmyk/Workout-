import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Database, DatabaseBackup, FileDown, FileSpreadsheet, FileUp, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useExerciseMap, useStore, type BackupData } from '../store/store';
import { AccountCard } from '../components/Account';
import { StrongImportSheet } from '../components/StrongImportSheet';
import { fmtClock, fmtDate, fmtDateTime, fmtNum, relativeDay } from '../lib/format';
import { listSnapshots, parseBackup, readSnapshot, SNAPSHOT_REASON_LABELS, useSafety, type SnapshotMeta } from '../lib/safety';
import { saveBackupFile, saveCsvFile } from '../lib/backup';
import { ask, confirmDialog, Segmented, Sheet, Switch, toast } from '../components/ui';
import type { Equipment, Experience, Goal, Sex } from '../types';
import { EQUIPMENT_LABELS } from '../data/exercises';
import { t, tn } from '../i18n';

function Row({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="list-item">
      <div className="grow">
        <div className="bold">{title}</div>
        {desc && <div className="small muted">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

const ALL_PLATES = [50, 25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5];

export default function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const importBackup = useStore((s) => s.importBackup);
  const resetAll = useStore((s) => s.resetAll);
  const workouts = useStore((s) => s.workouts);
  const exMap = useExerciseMap();
  const navigate = useNavigate();
  const jsonRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [strongText, setStrongText] = useState<string | null>(null);

  const persistent = useSafety((s) => s.persistent);
  const lastSavedAt = useSafety((s) => s.lastSavedAt);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  useEffect(() => {
    void listSnapshots().then(setSnapshots);
  }, [showSnapshots]);

  const applyBackup = async (data: Partial<BackupData>, label: string) => {
    const n = data.workouts?.length ?? 0;
    const mode = await ask(
      tn(n, '{label}: {n} workout', '{label}: {n} workouts', { label }),
      t('Merge it with your current data, or replace everything? The app saves a restore point of your current data first.'),
      [
        { label: t('Merge with current data'), value: 'merge' as const, kind: 'primary' },
        { label: t('Replace all data'), value: 'replace' as const, kind: 'danger' },
        { label: t('Cancel'), value: null, kind: 'plain' },
      ],
    );
    if (!mode) return;
    importBackup(data, mode);
    toast(mode === 'merge' ? t('Backup merged') : t('Data replaced with backup'));
  };

  const onJson = async (file: File) => {
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      toast(parsed.error, 'error', 5000);
      return;
    }
    await applyBackup(parsed.data as Partial<BackupData>, parsed.exportedAt ? t('Backup from {date}', { date: fmtDate(Date.parse(parsed.exportedAt)) }) : t('Backup'));
  };


  const notifications = 'Notification' in window ? Notification.permission : 'unsupported';

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          ‹ {t('Back')}
        </button>
      </div>
      <h1 style={{ marginBottom: 16 }}>{t('Settings')}</h1>

      <div style={{ marginBottom: 20 }}>
        <AccountCard />
      </div>

      <div className="section-title">
        <h2>{t('Profile')}</h2>
      </div>
      <div className="list">
        <Row title={t('Name')}>
          <input style={{ width: 160 }} value={settings.name} placeholder={t('Your name')} onChange={(e) => update({ name: e.target.value })} />
        </Row>
        <Row title={t('Gender')} desc={t('Used for the body map')}>
          <select style={{ width: 130 }} value={settings.sex ?? ''} onChange={(e) => update({ sex: (e.target.value || undefined) as Sex | undefined })}>
            <option value="">{t('Rather not say')}</option>
            <option value="m">{t('Male')}</option>
            <option value="f">{t('Female')}</option>
          </select>
        </Row>
        <Row title={t('Birth year')} desc={t('Optional')}>
          <select
            style={{ width: 130 }}
            value={settings.birthYear ?? ''}
            onChange={(e) => update({ birthYear: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">{t('Rather not say')}</option>
            {Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - 12 - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Row>
        <Row title={t('Goal')}>
          <select style={{ width: 130 }} value={settings.goal} onChange={(e) => update({ goal: e.target.value as Goal })}>
            <option value="strength">{t('Strength')}</option>
            <option value="muscle">{t('Muscle')}</option>
            <option value="fitness">{t('Fitness')}</option>
            <option value="weightloss">{t('Weight loss')}</option>
          </select>
        </Row>
        <Row title={t('Experience')}>
          <select style={{ width: 190 }} value={settings.experience} onChange={(e) => update({ experience: e.target.value as Experience })}>
            <option value="beginner">{t('Beginner')}</option>
            <option value="intermediate">{t('Intermediate')}</option>
            <option value="advanced">{t('Advanced')}</option>
          </select>
        </Row>
      </div>

      <div className="section-title mt-l">
        <h2>{t('General')}</h2>
      </div>
      <div className="list">
        <Row title={t('Units')}>
          <div style={{ width: 120 }}>
            <Segmented
              value={settings.unit}
              onChange={(unit) => update({ unit })}
              options={[
                { value: 'kg', label: 'kg' },
                { value: 'lb', label: 'lb' },
              ]}
            />
          </div>
        </Row>
        <Row title={t('Appearance')}>
          <div style={{ width: 190 }}>
            <Segmented
              value={settings.theme}
              onChange={(theme) => update({ theme })}
              options={[
                { value: 'dark', label: t('Dark') },
                { value: 'light', label: t('Light') },
                { value: 'system', label: t('Auto') },
              ]}
            />
          </div>
        </Row>
        <Row title={t('Weekly goal')} desc={t('Workouts per week')}>
          <select style={{ width: 80 }} value={settings.weeklyGoal} onChange={(e) => update({ weeklyGoal: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </Row>
      </div>

      <div className="section-title mt-l">
        <h2>{t('Workout')}</h2>
      </div>
      <div className="list">
        <Row title={t('Default rest')} desc={t('Between sets')}>
          <select style={{ width: 100 }} value={settings.defaultRestSec} onChange={(e) => update({ defaultRestSec: Number(e.target.value) })}>
            {[30, 45, 60, 90, 120, 150, 180, 240, 300].map((s) => (
              <option key={s} value={s}>
                {fmtClock(s)}
              </option>
            ))}
          </select>
        </Row>
        <Row title={t('Auto-start rest timer')} desc={t('When you tick off a set')}>
          <Switch on={settings.autoStartRest} onChange={(autoStartRest) => update({ autoStartRest })} />
        </Row>
        <Row title={t('Sound when rest ends')}>
          <Switch on={settings.sound} onChange={(sound) => update({ sound })} />
        </Row>
        <Row title={t('Vibrate when rest ends')}>
          <Switch on={settings.vibrate} onChange={(vibrate) => update({ vibrate })} />
        </Row>
        {notifications !== 'unsupported' && notifications !== 'granted' && (
          <Row title={t('Notifications')} desc={t('Get notified when rest ends while the app is in the background')}>
            <button
              className="btn sm soft"
              onClick={async () => {
                const r = await Notification.requestPermission();
                toast(r === 'granted' ? t('Notifications on') : t('Notifications not allowed'));
              }}
            >
              {t('Allow')}
            </button>
          </Row>
        )}
        <Row title={t('Log RPE')} desc={t('How hard a set felt (6–10)')}>
          <Switch on={settings.showRpe} onChange={(showRpe) => update({ showRpe })} />
        </Row>
        <Row title={t('Smart coach')} desc={t('Suggests weight and reps based on your last workout')}>
          <Switch on={settings.smartCoach} onChange={(smartCoach) => update({ smartCoach })} />
        </Row>
      </div>

      <div className="section-title mt-l">
        <h2>{t('My equipment')}</h2>
      </div>
      <div className="card">
        <div className="small muted" style={{ marginBottom: 10 }}>
          {t('The workout generator only picks exercises that use this equipment.')}
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((eq) => {
            const on = settings.equipment.includes(eq);
            return (
              <button
                key={eq}
                className={`chip ${on ? 'on' : ''}`}
                onClick={() => update({ equipment: on ? settings.equipment.filter((x) => x !== eq) : [...settings.equipment, eq] })}
              >
                {t(EQUIPMENT_LABELS[eq])}
              </button>
            );
          })}
        </div>
        <div className="row mt" style={{ gap: 8 }}>
          <button className="btn sm grow" onClick={() => update({ equipment: Object.keys(EQUIPMENT_LABELS) as Equipment[] })}>
            {t('Gym')}
          </button>
          <button className="btn sm grow" onClick={() => update({ equipment: ['dumbbell', 'bodyweight', 'band', 'other'] })}>
            {t('Home')}
          </button>
        </div>
      </div>

      <div className="section-title mt-l">
        <h2>{t('Bar and plates')}</h2>
      </div>
      <div className="card">
        <div className="field">
          <label>{t('Bar weight (kg)')}</label>
          <select value={settings.barWeightKg} onChange={(e) => update({ barWeightKg: Number(e.target.value) })}>
            {[5, 7, 10, 15, 20, 25].map((b) => (
              <option key={b} value={b}>
                {b} kg
              </option>
            ))}
          </select>
        </div>
        <div className="field mt">
          <label>{t('Available plates (kg)')}</label>
          <div className="row wrap" style={{ gap: 6 }}>
            {ALL_PLATES.map((p) => {
              const on = settings.plates.includes(p);
              return (
                <button
                  key={p}
                  className={`chip ${on ? 'on' : ''}`}
                  onClick={() =>
                    update({
                      plates: on ? settings.plates.filter((x) => x !== p) : [...settings.plates, p].sort((a, b) => b - a),
                    })
                  }
                >
                  {fmtNum(p, 2)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="section-title mt-l">
        <h2>{t('Data safety')}</h2>
      </div>
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <ShieldCheck size={22} className="accent" style={{ marginTop: 2 }} />
          <div className="grow small">
            <div className="bold" style={{ fontSize: 15 }}>
              {t('Your data lives only on this device')}
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              {t(
                'Every change is saved instantly. The app also makes a restore point every day and before anything risky. But if you lose or replace your phone, only a backup stored off the device will help.',
              )}
            </div>
            <div className="data-facts">
              <span>
                {t('Last saved:')} <b>{lastSavedAt ? fmtDateTime(lastSavedAt) : t('nothing yet this session')}</b>
              </span>
              <span>
                {t('Backup file:')} <b>{settings.lastBackupAt ? relativeDay(settings.lastBackupAt) : t('never')}</b>
              </span>
              <span>
                {t('Protection from browser cleanup:')}{' '}
                <b>{persistent === true ? t('on') : persistent === false ? t('not allowed by the browser') : t('not supported')}</b>
              </span>
            </div>
          </div>
        </div>
        <button className="btn primary block mt" onClick={() => void saveBackupFile()}>
          <FileDown size={18} /> {t('Save backup to file')}
        </button>
        <div className="tiny muted mt">
          {t('On your phone, the share sheet opens. Save the backup to Files or Google Drive, or email it to yourself.')}
        </div>
      </div>

      <div className="list mt">
        <button className="list-item" onClick={() => jsonRef.current?.click()}>
          <Upload size={20} className="muted" />
          <div className="grow">
            <div className="bold">{t('Restore from file')}</div>
            <div className="small muted">{t('Loads a backup you saved earlier. Your current data gets a restore point first.')}</div>
          </div>
        </button>
        <button className="list-item" onClick={() => setShowSnapshots(true)}>
          <DatabaseBackup size={20} className="muted" />
          <div className="grow">
            <div className="bold">{t('Restore points')}</div>
            <div className="small muted">
              {snapshots.length
                ? tn(snapshots.length, '{n} saved · latest: {when}', '{n} saved · latest: {when}', {
                    when: relativeDay(snapshots[0].at),
                  })
                : t('None yet')}
            </div>
          </div>
          <span className="chev" />
        </button>
        <button className="list-item" onClick={() => csvRef.current?.click()}>
          <FileUp size={20} className="muted" />
          <div className="grow">
            <div className="bold">{t('Import from Strong')}</div>
            <div className="small muted">{t('In Strong: Settings → Export data (CSV)')}</div>
          </div>
        </button>
        <button className="list-item" onClick={() => void saveCsvFile(exMap)} disabled={!workouts.length}>
          <FileSpreadsheet size={20} className="muted" />
          <div className="grow">
            <div className="bold">{t('Export workouts (CSV)')}</div>
            <div className="small muted">{t('For Excel or Google Sheets, same format as Strong')}</div>
          </div>
        </button>
        <button
          className="list-item"
          onClick={async () => {
            if (
              await confirmDialog(
                t('Delete all data?'),
                t('Your workouts, routines and measurements will be removed from the app. A restore point made right before deleting stays in Restore points.'),
                t('Delete all'),
              )
            ) {
              resetAll();
              toast(t('Data deleted. You can bring it back from a restore point.'), 'info', 5000);
            }
          }}
        >
          <Trash2 size={20} className="danger" />
          <div className="grow">
            <div className="bold danger">{t('Delete all data')}</div>
          </div>
        </button>
      </div>

      {showSnapshots && (
        <Sheet title={t('Restore points')} onClose={() => setShowSnapshots(false)}>
          <p className="small muted" style={{ marginTop: 0 }}>
            {t(
              'The app keeps the last 7 daily restore points and 10 made before an import, restore or data reset. They live only on this device.',
            )}
          </p>
          <div className="list">
            {snapshots.map((snap) => (
              <button
                key={snap.id}
                className="list-item"
                onClick={async () => {
                  const data = (await readSnapshot(snap.id)) as Partial<BackupData> | null;
                  if (!data) return toast(t("Couldn't read this restore point"), 'error');
                  setShowSnapshots(false);
                  await applyBackup(data, t('{reason} from {date}', { reason: t(SNAPSHOT_REASON_LABELS[snap.reason]), date: fmtDateTime(snap.at) }));
                }}
              >
                <Database size={20} className="accent" />
                <div className="grow">
                  <div className="bold">{fmtDateTime(snap.at)}</div>
                  <div className="small muted">
                    {t(SNAPSHOT_REASON_LABELS[snap.reason])} · {tn(snap.workouts, '{n} workout', '{n} workouts')} ·{' '}
                    {fmtNum(snap.bytes / 1024, 0)} kB
                  </div>
                </div>
                <span className="small accent bold">{t('Restore')}</span>
              </button>
            ))}
            {!snapshots.length && <div className="empty">{t("None yet. The first one is made as soon as you have data in the app.")}</div>}
          </div>
        </Sheet>
      )}

      <input
        ref={jsonRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onJson(f);
          e.target.value = '';
        }}
      />
      <input
        ref={csvRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) setStrongText(await f.text());
        }}
      />

      {strongText !== null && <StrongImportSheet text={strongText} onClose={() => setStrongText(null)} />}
    </div>
  );
}
