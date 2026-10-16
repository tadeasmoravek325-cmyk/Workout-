import { useEffect, useState } from 'react';
import { AlertTriangle, DatabaseBackup, RotateCcw } from 'lucide-react';
import { finishLoad, listSnapshots, restoreSnapshotRaw, SNAPSHOT_REASON_LABELS, useSafety, type SnapshotMeta } from '../lib/safety';
import { fmtDateTime } from '../lib/format';
import { t, tn } from '../i18n';
import { confirmDialog, Dialogs } from './ui';

/** Shown instead of the app when stored data could not be read. Nothing is overwritten here without consent. */
export function DataRecovery() {
  const error = useSafety((s) => s.loadError);
  const [snaps, setSnaps] = useState<SnapshotMeta[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void listSnapshots().then(setSnaps);
  }, []);

  return (
    <div className="onboard">
      <div className="grow">
        <div className="recovery-icon">
          <AlertTriangle size={30} />
        </div>
        <h1 style={{ marginTop: 18 }}>{t("Couldn't load your data")}</h1>
        <p className="muted">
          {t(
            "The app didn't overwrite or delete anything. Try opening it again. If that doesn't help, restore one of the automatic restore points below.",
          )}
        </p>
        <p className="small muted">{t('Technical detail: {error}', { error: error ?? '' })}</p>

        <button className="btn primary block mt-l" onClick={() => location.reload()}>
          <RotateCcw size={18} /> {t('Try again')}
        </button>

        <h2 className="mt-l" style={{ marginTop: 28 }}>
          {t('Restore points')}
        </h2>
        <div className="list mt">
          {snaps === null && <div className="list-item muted">{t('Looking for restore points…')}</div>}
          {snaps?.length === 0 && <div className="list-item muted">{t('There are no restore points on this device.')}</div>}
          {snaps?.map((s) => (
            <button
              key={s.id}
              className="list-item"
              disabled={busy}
              onClick={async () => {
                if (
                  !(await confirmDialog(
                    t('Go back to this restore point?'),
                    tn(s.workouts, '{reason} from {date} ({n} workout).', '{reason} from {date} ({n} workouts).', {
                      reason: t(SNAPSHOT_REASON_LABELS[s.reason]),
                      date: fmtDateTime(s.at),
                    }),
                    t('Restore'),
                    false,
                  ))
                )
                  return;
                setBusy(true);
                if (await restoreSnapshotRaw(s.id)) location.reload();
                else setBusy(false);
              }}
            >
              <DatabaseBackup size={20} className="accent" />
              <div className="grow">
                <div className="bold">{fmtDateTime(s.at)}</div>
                <div className="small muted">
                  {t(SNAPSHOT_REASON_LABELS[s.reason])} · {tn(s.workouts, '{n} workout', '{n} workouts')}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <button
        className="btn danger block"
        style={{ marginTop: 24 }}
        onClick={async () => {
          if (
            await confirmDialog(
              t('Start with empty data?'),
              t('The unreadable data stays set aside on this device, but the app starts fresh. Try restoring a restore point first.'),
              t('Start fresh'),
            )
          ) {
            finishLoad();
          }
        }}
      >
        {t('Start with empty data')}
      </button>
      <Dialogs />
    </div>
  );
}

/** Persistent banner when saving fails (e.g. the device is out of space). */
export function SaveErrorBanner() {
  const saveError = useSafety((s) => s.saveError);
  if (!saveError) return null;
  return (
    <div className="save-error" role="alert">
      <AlertTriangle size={18} />
      <span className="grow">{saveError}</span>
    </div>
  );
}
