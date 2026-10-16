import { exportBackup, useExerciseMap, useStore } from '../store/store';
import { exportCsv } from './csv';
import { makeBackupFile, saveFile } from './safety';
import { toast } from '../components/ui';
import { t } from '../i18n';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Saves a full backup file and remembers when it happened. */
export async function saveBackupFile(): Promise<boolean> {
  const result = await saveFile(`gym-backup-${today()}.json`, makeBackupFile(exportBackup()), 'application/json');
  if (result === 'cancelled') return false;
  useStore.getState().updateSettings({ lastBackupAt: Date.now(), backupSnoozeUntil: undefined });
  toast(result === 'shared' ? t('Backup ready to share') : t('Backup saved to Downloads'));
  return true;
}

export async function saveCsvFile(exMap: ReturnType<typeof useExerciseMap>) {
  const result = await saveFile(`gym-workouts-${today()}.csv`, exportCsv(useStore.getState().workouts, exMap), 'text/csv');
  if (result !== 'cancelled') toast(t('Workout export saved'));
}

const DAY = 86_400_000;

/** Whether to nudge the user to save a backup. */
export function backupDue(workoutCount: number, lastBackupAt?: number, snoozeUntil?: number, now = Date.now()): boolean {
  if (workoutCount < 3) return false;
  if (snoozeUntil && now < snoozeUntil) return false;
  return !lastBackupAt || now - lastBackupAt > 14 * DAY;
}
