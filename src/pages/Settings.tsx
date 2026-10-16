import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportBackup, useAllExercises, useExerciseMap, useStore, type BackupData } from '../store/store';
import { exportCsv, importStrongCsv, type StrongImportResult } from '../lib/csv';
import { download } from '../lib/feedback';
import { fmtClock, fmtNum, plural } from '../lib/format';
import { ask, confirmDialog, Segmented, Sheet, Switch, toast } from '../components/ui';
import type { Equipment, Experience, Goal, Sex, Unit } from '../types';
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
  const importWorkouts = useStore((s) => s.importWorkouts);
  const resetAll = useStore((s) => s.resetAll);
  const workouts = useStore((s) => s.workouts);
  const exMap = useExerciseMap();
  const allExercises = useAllExercises();
  const navigate = useNavigate();
  const jsonRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [strong, setStrong] = useState<{ text: string; unit: Unit; result?: StrongImportResult; error?: string } | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const onJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Partial<BackupData>;
      if (!Array.isArray(data.workouts)) throw new Error('bad');
      const mode = await ask(`Záloha obsahuje ${data.workouts.length} tréninků`, 'Chceš ji sloučit se současnými daty, nebo jimi všechno nahradit?', [
        { label: 'Sloučit se současnými daty', value: 'merge' as const, kind: 'primary' },
        { label: 'Nahradit všechna data', value: 'replace' as const, kind: 'danger' },
        { label: 'Zrušit', value: null, kind: 'plain' },
      ]);
      if (!mode) return;
      importBackup(data, mode);
      toast('Záloha obnovena');
    } catch {
      toast('Tohle není platná záloha');
    }
  };

  const parseStrong = (text: string, unit: Unit) => {
    try {
      setStrong({ text, unit, result: importStrongCsv(text, unit, allExercises) });
    } catch (e) {
      setStrong({ text, unit, error: (e as Error).message });
    }
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
          <select style={{ width: 150 }} value={settings.experience} onChange={(e) => update({ experience: e.target.value as Experience })}>
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
            🏋️ Posilovna
          </button>
          <button className="btn sm grow" onClick={() => update({ equipment: ['dumbbell', 'bodyweight', 'band', 'other'] })}>
            🏠 Doma
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
        <h2>Data</h2>
      </div>
      <div className="list">
        <button className="list-item" onClick={() => csvRef.current?.click()}>
          <div className="avatar">📥</div>
          <div className="grow">
            <div className="bold">Importovat ze Strong</div>
            <div className="small muted">Strong → Nastavení → Export dat (CSV)</div>
          </div>
          <span className="chev" />
        </button>
        <button
          className="list-item"
          onClick={() => {
            download(`gym-zaloha-${today}.json`, JSON.stringify(exportBackup()), 'application/json');
            toast('Záloha stažena');
          }}
        >
          <div className="avatar">💾</div>
          <div className="grow">
            <div className="bold">Zálohovat (JSON)</div>
            <div className="small muted">Kompletní záloha včetně rutin a měření</div>
          </div>
        </button>
        <button className="list-item" onClick={() => jsonRef.current?.click()}>
          <div className="avatar">♻️</div>
          <div className="grow">
            <div className="bold">Obnovit ze zálohy</div>
            <div className="small muted">Načíst dříve uložený JSON soubor</div>
          </div>
        </button>
        <button
          className="list-item"
          onClick={() => download(`gym-treninky-${today}.csv`, exportCsv(workouts, exMap), 'text/csv')}
          disabled={!workouts.length}
        >
          <div className="avatar">📄</div>
          <div className="grow">
            <div className="bold">Exportovat tréninky (CSV)</div>
            <div className="small muted">Pro Excel / Tabulky Google, formát kompatibilní se Strong</div>
          </div>
        </button>
        <button
          className="list-item"
          onClick={async () => {
            if (await confirmDialog('Smazat všechna data?', 'Tréninky, rutiny i měření zmizí a nejde to vrátit. Doporučujeme si nejdřív stáhnout zálohu.', 'Smazat vše')) {
              resetAll();
              toast('Data smazána');
            }
          }}
        >
          <div className="avatar">🗑</div>
          <div className="grow">
            <div className="bold danger">Smazat všechna data</div>
          </div>
        </button>
      </div>

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
          if (f) parseStrong(await f.text(), settings.unit);
        }}
      />

      {strong && (
        <Sheet title="Import ze Strong" onClose={() => setStrong(null)}>
          {strong.error ? (
            <div className="card danger">{strong.error}</div>
          ) : (
            strong.result && (
              <div className="stack">
                <div className="field">
                  <label>V jakých jednotkách jsi měl Strong nastavený?</label>
                  <Segmented
                    value={strong.unit}
                    onChange={(u) => parseStrong(strong.text, u)}
                    options={[
                      { value: 'kg', label: 'kg' },
                      { value: 'lb', label: 'lb' },
                    ]}
                  />
                </div>
                <div className="card">
                  <div style={{ fontSize: 22, fontWeight: 800 }}>
                    {strong.result.workouts.length} {plural(strong.result.workouts.length, ['trénink', 'tréninky', 'tréninků'])}
                  </div>
                  <div className="small muted">
                    {strong.result.workouts.reduce((a, w) => a + w.exercises.reduce((b, e) => b + e.sets.length, 0), 0)} sérií
                  </div>
                </div>
                {strong.result.unmatched.length > 0 && (
                  <div className="card small">
                    <div className="bold">Nové vlastní cviky ({strong.result.unmatched.length}):</div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {strong.result.unmatched.join(', ')}
                    </div>
                  </div>
                )}
                <button
                  className="btn primary block"
                  onClick={() => {
                    const n = importWorkouts(strong.result!.workouts, strong.result!.newExercises);
                    toast(`Importováno ${n} ${plural(n, ['trénink', 'tréninky', 'tréninků'])}`);
                    setStrong(null);
                  }}
                >
                  Importovat
                </button>
                <div className="tiny muted center">Tréninky, které už máš (stejný čas začátku), se přeskočí.</div>
              </div>
            )
          )}
        </Sheet>
      )}
    </div>
  );
}
