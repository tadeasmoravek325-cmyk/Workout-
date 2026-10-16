import { useEffect, useState } from 'react';
import { AlertTriangle, DatabaseBackup, RotateCcw } from 'lucide-react';
import { finishLoad, listSnapshots, restoreSnapshotRaw, SNAPSHOT_REASON_LABELS, useSafety, type SnapshotMeta } from '../lib/safety';
import { fmtDateTime, plural } from '../lib/format';
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
        <h1 style={{ marginTop: 18 }}>Data se nepodařilo načíst</h1>
        <p className="muted">
          Aplikace tvoje data nepřepsala a nic nesmazala. Zkus ji otevřít znovu. Když to nepomůže, obnov některou z automatických záloh
          níže.
        </p>
        <p className="small muted">Technický detail: {error}</p>

        <button className="btn primary block mt-l" onClick={() => location.reload()}>
          <RotateCcw size={18} /> Zkusit znovu
        </button>

        <h2 className="mt-l" style={{ marginTop: 28 }}>
          Automatické zálohy
        </h2>
        <div className="list mt">
          {snaps === null && <div className="list-item muted">Hledám zálohy…</div>}
          {snaps?.length === 0 && <div className="list-item muted">V tomto zařízení žádná automatická záloha není.</div>}
          {snaps?.map((s) => (
            <button
              key={s.id}
              className="list-item"
              disabled={busy}
              onClick={async () => {
                if (!(await confirmDialog('Obnovit tuto zálohu?', `${SNAPSHOT_REASON_LABELS[s.reason]} z ${fmtDateTime(s.at)} (${s.workouts} ${plural(s.workouts, ['trénink', 'tréninky', 'tréninků'])}).`, 'Obnovit', false)))
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
                  {SNAPSHOT_REASON_LABELS[s.reason]} · {s.workouts} {plural(s.workouts, ['trénink', 'tréninky', 'tréninků'])}
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
              'Začít s prázdnými daty?',
              'Nečitelná data zůstanou odložená v zařízení, ale aplikace začne nanovo. Nejdřív zkus obnovit zálohu.',
              'Začít nanovo',
            )
          ) {
            finishLoad();
          }
        }}
      >
        Začít s prázdnými daty
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
