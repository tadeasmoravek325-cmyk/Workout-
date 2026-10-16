import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Database, DatabaseBackup, FileDown, FileSpreadsheet, FileUp, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useExerciseMap, useStore, type BackupData } from '../store/store';
import { StrongImportSheet } from '../components/StrongImportSheet';
import { fmtClock, fmtDate, fmtDateTime, fmtNum, plural, relativeDay } from '../lib/format';
import { listSnapshots, parseBackup, readSnapshot, SNAPSHOT_REASON_LABELS, useSafety, type SnapshotMeta } from '../lib/safety';
import { saveBackupFile, saveCsvFile } from '../lib/backup';
import { ask, confirmDialog, Segmented, Sheet, Switch, toast } from '../components/ui';
import type { Equipment, Experience, Goal, Sex } from '../types';
import { EQUIPMENT_LABELS } from '../data/exercises';

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
    const mode = await ask(`${label}: ${n} ${plural(n, ['trénink', 'tréninky', 'tréninků'])}`, 'Chceš ji sloučit se současnými daty, nebo jimi všechno nahradit? Před změnou si aplikace sama uloží zálohu současného stavu.', [
      { label: 'Sloučit se současnými daty', value: 'merge' as const, kind: 'primary' },
      { label: 'Nahradit všechna data', value: 'replace' as const, kind: 'danger' },
      { label: 'Zrušit', value: null, kind: 'plain' },
    ]);
    if (!mode) return;
    importBackup(data, mode);
    toast(mode === 'merge' ? 'Záloha sloučena' : 'Data nahrazena zálohou');
  };

  const onJson = async (file: File) => {
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      toast(parsed.error, 'error', 5000);
      return;
    }
    await applyBackup(parsed.data as Partial<BackupData>, parsed.exportedAt ? `Záloha z ${fmtDate(Date.parse(parsed.exportedAt))}` : 'Záloha');
  };


  const notifications = 'Notification' in window ? Notification.permission : 'unsupported';

  return (
    <div className="page">
      <div className="page-header">
        <button className="back" onClick={() => navigate(-1)}>
          ‹ Zpět
        </button>
      </div>
      <h1 style={{ marginBottom: 16 }}>Nastavení</h1>

      <div className="section-title">
        <h2>Profil</h2>
      </div>
      <div className="list">
        <Row title="Jméno">
          <input style={{ width: 160 }} value={settings.name} placeholder="Tvoje jméno" onChange={(e) => update({ name: e.target.value })} />
        </Row>
        <Row title="Pohlaví" desc="Pro silové ranky">
          <select style={{ width: 130 }} value={settings.sex ?? ''} onChange={(e) => update({ sex: (e.target.value || undefined) as Sex | undefined })}>
            <option value="">Neuvádět</option>
            <option value="m">Muž</option>
            <option value="f">Žena</option>
          </select>
        </Row>
        <Row title="Cíl">
          <select style={{ width: 130 }} value={settings.goal} onChange={(e) => update({ goal: e.target.value as Goal })}>
            <option value="strength">Síla</option>
            <option value="muscle">Svaly</option>
            <option value="fitness">Kondice</option>
            <option value="weightloss">Hubnutí</option>
          </select>
        </Row>
        <Row title="Zkušenosti">
          <select style={{ width: 190 }} value={settings.experience} onChange={(e) => update({ experience: e.target.value as Experience })}>
            <option value="beginner">Začátečník</option>
            <option value="intermediate">Mírně pokročilý</option>
            <option value="advanced">Pokročilý</option>
          </select>
        </Row>
      </div>

      <div className="section-title mt-l">
        <h2>Obecné</h2>
      </div>
      <div className="list">
        <Row title="Jednotky">
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
        <Row title="Vzhled">
          <div style={{ width: 190 }}>
            <Segmented
              value={settings.theme}
              onChange={(theme) => update({ theme })}
              options={[
                { value: 'dark', label: 'Tmavý' },
                { value: 'light', label: 'Světlý' },
                { value: 'system', label: 'Auto' },
              ]}
            />
          </div>
        </Row>
        <Row title="Týdenní cíl" desc="Počet tréninků za týden">
          <select style={{ width: 80 }} value={settings.weeklyGoal} onChange={(e) => update({ weeklyGoal: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </Row>
      </div>

      <div className="section-title mt-l">
        <h2>Trénink</h2>
      </div>
      <div className="list">
        <Row title="Výchozí pauza" desc="Mezi sériemi">
          <select style={{ width: 100 }} value={settings.defaultRestSec} onChange={(e) => update({ defaultRestSec: Number(e.target.value) })}>
            {[30, 45, 60, 90, 120, 150, 180, 240, 300].map((s) => (
              <option key={s} value={s}>
                {fmtClock(s)}
              </option>
            ))}
          </select>
        </Row>
        <Row title="Automaticky spustit pauzu" desc="Po odškrtnutí série">
          <Switch on={settings.autoStartRest} onChange={(autoStartRest) => update({ autoStartRest })} />
        </Row>
        <Row title="Zvuk na konci pauzy">
          <Switch on={settings.sound} onChange={(sound) => update({ sound })} />
        </Row>
        <Row title="Vibrace na konci pauzy">
          <Switch on={settings.vibrate} onChange={(vibrate) => update({ vibrate })} />
        </Row>
        {notifications !== 'unsupported' && notifications !== 'granted' && (
          <Row title="Upozornění" desc="Oznámení o konci pauzy, když je aplikace na pozadí">
            <button
              className="btn sm soft"
              onClick={async () => {
                const r = await Notification.requestPermission();
                toast(r === 'granted' ? 'Upozornění povolena' : 'Upozornění nepovolena');
              }}
            >
              Povolit
            </button>
          </Row>
        )}
        <Row title="Zapisovat RPE" desc="Subjektivní náročnost série (6–10)">
          <Switch on={settings.showRpe} onChange={(showRpe) => update({ showRpe })} />
        </Row>
        <Row title="Chytrý trenér" desc="Návrh váhy a opakování podle minulého tréninku">
          <Switch on={settings.smartCoach} onChange={(smartCoach) => update({ smartCoach })} />
        </Row>
      </div>

      <div className="section-title mt-l">
        <h2>Moje vybavení</h2>
      </div>
      <div className="card">
        <div className="small muted" style={{ marginBottom: 10 }}>
          Generátor tréninku vybírá jen cviky s tímto vybavením.
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
                {EQUIPMENT_LABELS[eq]}
              </button>
            );
          })}
        </div>
        <div className="row mt" style={{ gap: 8 }}>
          <button className="btn sm grow" onClick={() => update({ equipment: Object.keys(EQUIPMENT_LABELS) as Equipment[] })}>
            Posilovna
          </button>
          <button className="btn sm grow" onClick={() => update({ equipment: ['dumbbell', 'bodyweight', 'band', 'other'] })}>
            Doma
          </button>
        </div>
      </div>

      <div className="section-title mt-l">
        <h2>Osa a kotouče</h2>
      </div>
      <div className="card">
        <div className="field">
          <label>Váha osy (kg)</label>
          <select value={settings.barWeightKg} onChange={(e) => update({ barWeightKg: Number(e.target.value) })}>
            {[5, 7, 10, 15, 20, 25].map((b) => (
              <option key={b} value={b}>
                {b} kg
              </option>
            ))}
          </select>
        </div>
        <div className="field mt">
          <label>Dostupné kotouče (kg)</label>
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
        <h2>Bezpečnost dat</h2>
      </div>
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <ShieldCheck size={22} className="accent" style={{ marginTop: 2 }} />
          <div className="grow small">
            <div className="bold" style={{ fontSize: 15 }}>
              Data jsou uložená jen v tomto zařízení
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              Každá změna se ukládá okamžitě. Aplikace si navíc každý den a před každou riskantní akcí dělá automatickou zálohu. Při ztrátě
              nebo výměně telefonu ale pomůže jen záloha uložená mimo zařízení.
            </div>
            <div className="data-facts">
              <span>
                Poslední uložení: <b>{lastSavedAt ? fmtDateTime(lastSavedAt) : 'v tomto spuštění zatím nic'}</b>
              </span>
              <span>
                Záloha do souboru: <b>{settings.lastBackupAt ? relativeDay(settings.lastBackupAt) : 'ještě nikdy'}</b>
              </span>
              <span>
                Ochrana před smazáním prohlížečem: <b>{persistent === true ? 'zapnutá' : persistent === false ? 'prohlížeč ji nepovolil' : 'nepodporováno'}</b>
              </span>
            </div>
          </div>
        </div>
        <button className="btn primary block mt" onClick={() => void saveBackupFile()}>
          <FileDown size={18} /> Uložit zálohu do souboru
        </button>
        <div className="tiny muted mt">
          Na telefonu se otevře sdílení. Zálohu si ulož do Souborů, na Disk Google nebo si ji pošli e-mailem.
        </div>
      </div>

      <div className="list mt">
        <button className="list-item" onClick={() => jsonRef.current?.click()}>
          <Upload size={20} className="muted" />
          <div className="grow">
            <div className="bold">Obnovit ze souboru</div>
            <div className="small muted">Načte zálohu uloženou dříve. Před změnou se současný stav sám zazálohuje.</div>
          </div>
        </button>
        <button className="list-item" onClick={() => setShowSnapshots(true)}>
          <DatabaseBackup size={20} className="muted" />
          <div className="grow">
            <div className="bold">Automatické zálohy</div>
            <div className="small muted">
              {snapshots.length ? `${snapshots.length} uložených, poslední ${relativeDay(snapshots[0].at).toLowerCase()}` : 'Zatím žádná'}
            </div>
          </div>
          <span className="chev" />
        </button>
        <button className="list-item" onClick={() => csvRef.current?.click()}>
          <FileUp size={20} className="muted" />
          <div className="grow">
            <div className="bold">Importovat ze Strong</div>
            <div className="small muted">Ve Strong: Nastavení → Export dat (CSV)</div>
          </div>
        </button>
        <button className="list-item" onClick={() => void saveCsvFile(exMap)} disabled={!workouts.length}>
          <FileSpreadsheet size={20} className="muted" />
          <div className="grow">
            <div className="bold">Exportovat tréninky (CSV)</div>
            <div className="small muted">Pro Excel nebo Tabulky Google, stejný formát jako Strong</div>
          </div>
        </button>
        <button
          className="list-item"
          onClick={async () => {
            if (
              await confirmDialog(
                'Smazat všechna data?',
                'Tréninky, rutiny i měření zmizí z aplikace. Automatická záloha těsně před smazáním zůstane v Automatických zálohách.',
                'Smazat vše',
              )
            ) {
              resetAll();
              toast('Data smazána. Obnovit je jde z automatické zálohy.', 'info', 5000);
            }
          }}
        >
          <Trash2 size={20} className="danger" />
          <div className="grow">
            <div className="bold danger">Smazat všechna data</div>
          </div>
        </button>
      </div>

      {showSnapshots && (
        <Sheet title="Automatické zálohy" onClose={() => setShowSnapshots(false)}>
          <p className="small muted" style={{ marginTop: 0 }}>
            Uchovává se posledních 7 denních záloh a 10 záloh pořízených před importem, obnovením nebo smazáním dat. Jsou jen v tomto
            zařízení.
          </p>
          <div className="list">
            {snapshots.map((snap) => (
              <button
                key={snap.id}
                className="list-item"
                onClick={async () => {
                  const data = (await readSnapshot(snap.id)) as Partial<BackupData> | null;
                  if (!data) return toast('Tuto zálohu se nepodařilo přečíst', 'error');
                  setShowSnapshots(false);
                  await applyBackup(data, `${SNAPSHOT_REASON_LABELS[snap.reason]} z ${fmtDateTime(snap.at)}`);
                }}
              >
                <Database size={20} className="accent" />
                <div className="grow">
                  <div className="bold">{fmtDateTime(snap.at)}</div>
                  <div className="small muted">
                    {SNAPSHOT_REASON_LABELS[snap.reason]} · {snap.workouts} {plural(snap.workouts, ['trénink', 'tréninky', 'tréninků'])} ·{' '}
                    {fmtNum(snap.bytes / 1024, 0)} kB
                  </div>
                </div>
                <span className="small accent bold">Obnovit</span>
              </button>
            ))}
            {!snapshots.length && <div className="empty">Zatím žádná. První se vytvoří, jakmile budeš mít v aplikaci data.</div>}
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
