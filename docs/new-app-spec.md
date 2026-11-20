# Nová fitness aplikace: produktové a technické podklady

Verze 1 · vychází z reálného stavu stávající aplikace (repozitář `Workout-`) a z toho, co se při jejím vývoji osvědčilo a co ne. Ověřené a neověřené věci jsou označeny. Nic zde není slib výkonu nebo časového odhadu.

---

## 1. Cíl a principy

**Cíl:** osobní silový deník, který (1) zapisuje trénink rychle jednou rukou v posilovně, (2) dlouhodobě vyhodnocuje progres, (3) radí s vysvětlením, (4) nikdy neztratí data.

**Jeden uživatel, žádné provozní náklady.** Žádné předplatné, žádné placené API, žádné povinné cloudové služby.

**Principy (pořadí = priorita):**
1. **Data jsou nedotknutelná.** Žádná destruktivní migrace, každá změna schématu zálohovaná, automatické snapshoty, export/import.
2. **Správnost výpočtů.** Veškerá analytika je čistý TypeScript s testy, bez Reactu.
3. **Rychlost zápisu.** Zápis série ≤ 2 klepnutí, minulý výkon vždy na očích.
4. **Offline první.** Vše kromě volitelných částí (cloud sync, AI) funguje bez internetu.
5. **Poradce, ne diktátor.** Aplikace navrhuje, uživatel potvrzuje. Nic se samo nezapisuje do plánu.
6. **Poctivost dat.** Při nedostatku záznamů aplikace řekne „málo dat“ a nevymýšlí závěry.

---

## 2. Co vzít ze stávající aplikace a co udělat jinak

### 2.1 Limity stávající aplikace (ověřeno v kódu)
| Limit | Důsledek |
|---|---|
| Veškerý stav (workouts, routines, nastavení) je **jeden velký JSON** v zustand `persist` do IndexedDB. | Při každé změně se serializuje celý objekt. S rostoucí historií (dnes 326 tréninků) to zpomaluje a ztěžuje dotazy. |
| Žádné indexy, žádné dotazy. Analytika vždy prochází všechny tréninky. | Přehledy za dlouhé období se počítají znovu při každém vykreslení. |
| Svalové zatížení je jedno číslo (`muscleLoad`), ne přímé/nepřímé. | Dá se rozlišit jen heuristikou (práh). |
| RIR neexistuje, jen volitelné RPE (skryté nastavením). | Progres engine musí RIR dopočítávat. |
| Cviky se identifikují jen ID a jménem; import ze Strongu vytvářel vlastní cviky vedle vestavěných. | Vznikly duplicity (např. „Squat (Smith Machine)“), které se musely slučovat dodatečně. |
| Čtyři překrývající se moduly pokroku (`suggestNext`, `overload`, `insights`, `progress/engine`). | Dvě různé definice stagnace. |
| Statická PWA na GitHub Pages: žádný server. | AI přes Ollamu je z HTTPS stránky na iPhonu problematická (viz 9). |
| Sync serializuje po dokumentech a „last-writer-wins“ po záznamech. | Funguje, ale nové typy dat (chat, recovery) vyžadují ověřit schéma. |
| Žádný český překlad (texty anglicky přes `t()`). | Uživatel píše česky. |

### 2.2 Osvědčené věci, které se vyplatí převzít (jako vzor, ne slepě kopírovat)
- Čisté funkce v `calc.ts`: `e1rm`, `computeRecords`, `detectPRs`, `exerciseHistory`, `prefillSets`.
- Logika období `periods.ts` (týdny, měsíce, předchozí období, bucket grafu).
- **Import ze Strongu (CSV)** včetně mapování jmen cviků.
- **Snapshoty před nebezpečnou akcí** (`safety.ts`): denní, před importem, před resetem, před slučováním.
- **Sync po záznamech s „tombstones“** pro smazané položky.
- Slučování duplicit cviků bez ztráty dat (`mergeExercises`).
- Design: tmavý režim, měděný akcent, Barlow Condensed pro nadpisy.

### 2.3 Poučení z iOS (ověřeno při vývoji)
- Táhnutí prvků: odstranění stisknutého prvku z DOM přeruší dotykové události. Řešit překryvnou vrstvou nebo ponechat prvek v DOM.
- Stavový řádek a „notch“: vždy `env(safe-area-inset-*)`, žádné pevné „cover“ pruhy.
- Klávesnice zakrývá spodní panely: vlastní číselná klávesnice (jako Keypad) místo systémové.
- `navigator.vibrate` na iOS Safari nefunguje (neověřeno pro vaši verzi, ověřit). Počítejte s tím, že haptika v PWA není spolehlivá.
- IndexedDB může být vyčištěno systémem, pokud aplikace není nainstalovaná na plochu. Volat `navigator.storage.persist()` a nabízet export.

---

## 3. Volba platformy (rozhodnutí č. 1)

| Varianta | Pro | Proti |
|---|---|---|
| **A. PWA (React + TypeScript + Vite)** | Znáte ji, nepotřebuje Apple účet, snadné nasazení, sdílitelná logika. | Omezení iOS (haptika, notifikace odpočinku na pozadí, úložiště). AI z telefonu složitější. |
| B. Nativní iOS (SwiftUI + SwiftData) | Lokální notifikace odpočinku, haptika, HealthKit, spolehlivé úložiště. | Vyžaduje Xcode; instalace na vlastní iPhone bez placeného účtu vyprší po 7 dnech (neověřeno aktuálně). Přepsání všech algoritmů. |
| C. PWA + Capacitor obal | Webová logika + nativní notifikace/haptika. | Další vrstva; Apple účet pro dlouhodobou instalaci. |

**Doporučení:** začít jako **PWA (A)** se silným oddělením logiky (`core/`) od UI. Tím je pozdější obal (C) levný. Nativní verzi zvažte, až narazíte na konkrétní omezení (notifikace odpočinku na zamčeném telefonu).

**Zachovat:** Vite, React, TypeScript, Recharts nebo jinou lehkou knihovnu grafů, Supabase sync jako volitelný.

---

## 4. Architektura

### 4.1 Struktura repozitáře
```
src/
  core/                 # čisté TypeScript funkce, žádný React, žádné I/O
    metrics/            # e1rm, volume, sets, frequency
    progress/           # engine.ts: jediný zdroj pravdy pro progres
    muscles/            # přímé/nepřímé série
    records/            # PR detekce
    reports/            # týdenní a měsíční
    coach/              # buildCoachContext, validace odpovědí, znalostní báze
  data/                 # databáze, repozitáře, migrace, import/export, sync
  features/             # workout, history, progress, exercises, plans, settings, coach
  ui/                   # design systém: komponenty, tokeny
  i18n/                 # čeština jako primární jazyk od začátku
tests/
docs/
```
**Pravidlo:** `core/` nikdy neimportuje z `data/`, `features/` ani `ui/`. Tím je všechna matematika testovatelná izolovaně.

### 4.2 Úložiště (rozhodnutí č. 2)
Místo jednoho velkého JSON použít **IndexedDB s oddělenými tabulkami a indexy** (např. přes knihovnu Dexie; nová závislost, nutno schválit).

| Tabulka | Klíč | Indexy |
|---|---|---|
| `workouts` | `id` | `startedAt`, `routineId` |
| `exercises` | `id` | `name`, `bodyPart` |
| `routines` | `id` | `folder` |
| `settings` | `key` | |
| `recovery` | `date` | |
| `chats`, `chatMessages` | `id` | `chatId`, `createdAt` |
| `snapshots` | `id` | `createdAt` |
| `changes` | auto | `table`, `updatedAt` (pro sync) |

Sety zůstanou vnořené uvnitř tréninku (nejpřirozenější dokument), ale **odvozené statistiky se ukládají do cache** (`exerciseStats`) a přepočítávají se jen pro cviky změněného tréninku.

**Migrace:** číslovaná verze schématu, každá migrace jen přidává; před spuštěním se vytvoří snapshot.

### 4.3 Stav v UI
Zustand zůstává pro **UI stav** (aktivní trénink, odpočinkový časovač, filtry). Trvalá data čtou komponenty přes dotazy (např. `useLiveQuery`). Aktivní trénink se ukládá průběžně po každé změně do IndexedDB, aby přežil pád nebo zavření aplikace.

### 4.4 Sync (volitelný)
- Supabase zůstává, jen jako **zálohovací a synchronizační vrstva**. Nic v aplikaci na ní nesmí záviset.
- Řádky `records(collection, id, data, updated_at)`, slučování po záznamu, mazání přes tombstone.
- **Neověřeno:** zda stávající tabulka `records` a RPC `sync_push` přijmou libovolný nový `collection` bez změny schématu. Před synchronizací chatů a recovery to ověřit.
- Chaty a recovery jsou osobnější data: sync pro ně **vypínatelný**, výchozí vypnuto.

### 4.5 Testování
- **Vitest** pro celé `core/`: jednotkové testy + testy s reálnými daty (anonymizovaná kopie vašich tréninků jako „zlatá“ data).
- **Playwright** pro mobilní scénáře (emulovaný iPhone): zápis tréninku, dokončení, obnovení po zavření.
- **Kontrola kompatibility dat:** test načte starý export a ověří, že se nic neztratí.

---

## 5. Datový model (TypeScript)

```ts
type Id = string;

interface Exercise {
  id: Id;                     // stabilní slug, nikdy se nemění
  name: string;
  aliases: string[];          // pro import a deduplikaci
  variantOf?: Id;             // varianta stejné základní pohybové dráhy
  equipment: 'barbell'|'dumbbell'|'machine'|'cable'|'smith'|'bodyweight'|'band'|'kettlebell'|'other';
  loadKind: 'total'|'perHand'|'bodyweightPlus'|'assisted'|'none';
  bilateral: boolean;
  muscles: { primary: Muscle[]; secondary: Muscle[] };   // přímé / nepřímé
  muscleWeights?: Partial<Record<Muscle, number>>;       // volitelné jemné váhy 0..1
  incrementKg?: number;       // nejmenší smysluplný přírůstek
  custom: boolean;
  archived?: boolean;         // místo mazání; historie zůstává
  favorite?: boolean;
  updatedAt: number;
}

type SetKind = 'working'|'warmup'|'drop'|'failure';
interface WorkoutSet {
  id: Id;
  kind: SetKind;
  weightKg?: number;          // vždy v kg
  reps?: number;
  durationSec?: number;
  distanceKm?: number;
  rir?: number;               // 0..5, volitelné; RPE = 10 − RIR (zobrazení)
  note?: string;
  restSec?: number;           // skutečný odpočinek před touto sérií
  done: boolean;
  completedAt?: number;
}

interface WorkoutExercise { id: Id; exerciseId: Id; sets: WorkoutSet[]; note?: string; supersetId?: Id; order: number; }
interface Workout { id: Id; name: string; routineId?: Id; planVersion?: number; startedAt: number; endedAt?: number; exercises: WorkoutExercise[]; note?: string; updatedAt: number; }

interface RoutineExercise { exerciseId: Id; sets: number; repMin: number; repMax: number; targetRir?: number; restSec?: number; supersetId?: Id; }
interface Routine { id: Id; name: string; folder?: string; exercises: RoutineExercise[]; version: number; updatedAt: number; }

interface ExerciseTarget { repMin: number; repMax: number; sets: number; targetRir?: number; focus?: 'strength'|'hypertrophy'|'both'; }
interface Recovery { date: string /* YYYY-MM-DD */; sleep?: 1|2|3|4|5; fatigue?: 1|2|3|4|5; soreness?: 1|2|3|4|5; note?: string; }
```
**Rozhodnutí č. 3 (RIR vs. RPE):** doporučuji ukládat **RIR** (to je to, co chcete řídit), RPE jen zobrazit jako 10 − RIR. Při importu ze Strongu (RPE) převést.

**Poučení z duplicit:** `aliases` + deduplikace při importu zabrání vzniku „strong-…“ kopií vestavěných cviků.

**Verze plánu:** `Workout.planVersion` umožní později porovnat plán se skutečným tréninkem (dnes stávající aplikace ukládá jen `routineId`).

---

## 6. Navigace

**Dolní lišta:** Home · History · **Workout** (střed) · Progress · More.
Exercises Library se přesune do More (používá se méně často než analytika). Při aktivním tréninku trvalý pruh nad lištou „Workout in progress · 0:34“ vede zpět do zápisu z každé obrazovky.

### Home (rozcestník, bez analytiky, kterou řeší Progress)
1. Pozdrav + datum.
2. **Další trénink** (rutina podle rozvrhu) s tlačítkem Start.
3. **Týden:** puntíky dnů, týdenní cíl, streak.
4. **Poslední PR** (3 položky, proklik).
5. **Jedna rada trenéra** (1 věta, proklik do Progress → Coach). Bez rady, pokud je málo dat.
6. Poslední tréninky (3).
Nic dalšího. Grafy a rozbory patří do Progress.

---

## 7. Zápis tréninku (nejdůležitější obrazovka)

**Požadavky:**
- Karta cviku: nadpis, „Minule“ (série z posledního tréninku) vedle aktuálních sérií.
- Řádek série: číslo / typ (W, D, F) / minule / váha / opakování / (RIR) / zaškrtnutí.
- Číselná klávesnice vlastní, s +/− krokem odpovídajícím `incrementKg`, kalkulačka kotoučů, RIR volba.
- Předvyplnění z minula (jen prázdná pole, nikdy nepřepsat zadané).
- **Doporučení pro příští sérii a pro příští trénink** z `core/progress`, jako návrh, který uživatel potvrdí klepnutím.
- Zahřívací série generovatelné z pracovní váhy.
- Odpočinkový časovač se skutečným odpočinkem ukládaným k sérii.
- Průběžné ukládání, obnovení po pádu.
- Přeuspořádání cviků tažením (vyřešené dotykové chyby viz 2.3), mazání série přejetím bez „undo“ toastu (preference uživatele).
- Po dokončení vždy potvrzovací okno; pokud se struktura odchýlila od rutiny, nabídnout „Update routine?“ (váhy a opakování tu okno nespouštějí).
- Odhad zbývajícího času.

---

## 8. Progress: analytika

### 8.1 Definice (jednotné v `core/metrics`, nikde jinde)
| Pojem | Definice |
|---|---|
| **Pracovní série** | `kind` ∈ {working, drop, failure}, `done`, `reps` > 0, `weightKg` > 0. Zahřívací série se nikdy nepočítají. |
| **Nejlepší jednotlivá série** | série s nejvyšším e1RM v daném cviku a tréninku. |
| **Nejlepší pracovní série** | série s nejvyšší váhou, při shodě s nejvíce opakováními. |
| **Volume load** | Σ(váha × opakování) pracovních sérií. **Údaj o práci, ne o svalovém růstu.** |
| **e1RM** | Epley `w·(1 + min(r,15)/30)` pro `r ≤ 12`; nad 12 opakování označit nespolehlivé. Volitelná alternativa Brzycki. |
| **Hard sets** | pracovní série s RIR ≤ 4, nebo bez RIR (počítáno s poznámkou „RIR neuvedeno“). |
| **Direct sets** | série cviku, kde je sval v `primary`. |
| **Indirect sets** | série cviku, kde je sval v `secondary`. Nikdy se nesčítají s direct jako stejnocenné série. |
| **Frekvence svalu** | počet tréninků v týdnu s ≥ 1 direct sérií na sval. |

Vždy rozlišovat v UI: **síla** (e1RM, pracovní váha), **objem práce** (volume load), **tréninková dávka** (počet hard sets). Celkový objem v kg nikdy neprezentovat jako míru svalového růstu.

### 8.2 Overview
Filtry: 4 týdny, 8 týdnů, 12 týdnů, 6 měsíců, celá historie. Porovnání s předchozím stejně dlouhým obdobím.
Karty: Strength progress, Training volume (volume load + hard sets), PR, frekvence, počet cviků v progresu, objem po svalech.
Grafy: vývoj e1RM (vybrané základní cviky), volume load, pracovní série, frekvence.
Prokliky: karta → detail cviku / svalu. Prázdný stav: „Zatím málo záznamů. Po 3 trénincích se tu objeví první přehled.“

### 8.3 Exercises
Seznam cviků s trendem (↑ → ↓) a poslední hodnotou. Detail cviku:
- aktuální pracovní váha, nejvyšší pracovní váha, nejlepší reps, e1RM, rekordy, počet tréninků od posledního PR;
- grafy: pracovní váha, opakování, e1RM, volume load, vývoj jednotlivých tréninků;
- porovnání dvou období (např. posledních 8 týdnů vs. předchozích 8);
- **nesrovnávat nekriticky** série s různým počtem opakování: e1RM z 15 opakování se označí nespolehlivé; varianty cviku (`variantOf`) se ve výchozím stavu nesčítají.

### 8.4 Muscles
Tabulka a graf: direct sets, indirect sets, týdenní objem, frekvence, trend. Proklik na cviky zatěžující sval. `BodyMap` (přední i zadní strana vedle sebe, jak jste preferoval) obarvená podle direct sets. **Aplikace nestanovuje ideální objem**; zobrazí jen rozmezí z literatury jako orientaci (viz 10).

### 8.5 PR
Typy: nejvyšší pracovní váha, nejvíc opakování při dané váze, nejlepší e1RM, nejvyšší objem cviku v tréninku. Chronologický seznam (More → Personal Records). Zahřívání se nepočítá.

---

## 9. Progressive overload engine (`core/progress`)

Základ je již napsaný a otestovaný ve stávající aplikaci (`src/lib/progress/engine.ts`, 10 testů) a je vhodný k přenesení a rozšíření.

**Metoda: double progression**
- Cíl: rozsah opakování `repMin–repMax`, počet sérií `sets`, cílové RIR.
- Všechny pracovní série na horní hranici (`repMax`) + RIR neukazuje selhání → navrhnout +přírůstek, opakování zpět na `repMin`.
- Jinak zůstat na váze a cílit +1 opakování na sérii.
- Příklad: 3 × 8–12 při 70 kg: 8/8/8 → 10/9/8 → 12/11/10 → 12/12/12 → návrh 72,5 kg.

**Stavy:** `ready`, `building`, `hold`, `stagnation`, `decline`, `insufficient`.

**Pravidla:**
- **Chybějící RIR:** nedomýšlí se; sníží se jistota a přidá se varování.
- **Stagnace:** ≥ 5 expozic, ≥ 14 dní, poslední 3 sezení nepřekonala předchozí základ (tolerance 0,5 %). Jeden špatný trénink nic nespouští.
- **Pokles:** 3 sezení v řadě klesající e1RM, celkově > 3 %. Zpráva **nepřisuzuje příčinu přetrénování**, jen vyjmenuje možné faktory (únava, spánek, změna plánu).
- Nad 12 opakování upozornit na nespolehlivé e1RM.
- **Prahy (3 %, 14 dní, 5 expozic) jsou heuristiky**, ne publikované standardy. V UI i dokumentaci je tak označit.

**Cíle:** globální (síla / hypertrofie / kombinace) určuje výchozí rozsahy (síla 3–6, hypertrofie 8–12, kombinace 6–10); každý cvik může mít vlastní rozsah, počet sérií, cílové RIR a prioritu.

**Navíc oproti stávající aplikaci:**
- Zohlednit pořadí cviku v tréninku a únavu na stejný sval (stávající `suggestNext` to už dělá; sjednotit do jednoho modulu).
- Zohlednit dlouhou pauzu (po 14 dnech nepřidávat, po 28 dnech začít lehčeji), zatím heuristika.
- Každý výstup nese: návrh, důvod, použitá data, jistotu (low/medium/high), varování.

**Žádný automatický zápis do tréninku.** Návrh se zobrazí, uživatel ho potvrdí.

---

## 10. Odborné zdroje a jak s nimi zacházet

Znalostní základna (`core/coach/knowledge.ts`) je oddělený soubor položek `{id, téma, tvrzení, síla důkazu, omezení, zdroj}`, který lze rozšiřovat. **Pravidlo:** aplikace ani AI necituje studii, která není v této bázi. **Odkazy a čísla před zařazením ověřit přímo ve zdroji** (v této práci jsem je nečetl celé; vycházím z abstraktů).

Témata, která má báze pokrýt (uvedeno zdrojově orientačně, ověřit):
- Objem a hypertrofie: Schoenfeld a spol. 2017 (dose-response, ~10+ týdenních sérií na sval jako orientace); Pelland a spol. (meta-regrese objemu); klesající přínos nad ~20 sérií/týden.
- Modely progrese: Plotkin a spol. 2022 (progrese zátěže vs. opakování, podobné výsledky u hypertrofie).
- Autoregulace RPE/RIR vs. procenta 1RM: srovnatelný efekt.
- Pořadí cviků: dřívější cviky v tréninku zlepšují sílu víc, hypertrofie podobná (Nunes 2020, Avelar 2019).
- Deload: **bez silného důkazu**, jen praktická heuristika. Označit jako názor, ne fakt.

U každé položky: „co to říká“, „co to neříká“, „komu to platí“. Žádná studie není univerzální pravidlo.

---

## 11. Recovery (volitelné, minimální)

Tři položky, vyplnění pod 10 sekund, nepovinné:
1. Spánek 1–5.
2. Únava 1–5.
3. Bolest svalů 1–5 (volitelně který sval).
Volitelná poznámka. **Nepřidávat** tep, HRV, hmotnost spánku apod., přínos je nízký a komplikuje použití. Využití: engine při poklesu výkonu zobrazí „v dnech před slabšími tréninky byla únava vyšší“ **jen pokud je dost záznamů** (např. ≥ 10), a jako možnou souvislost, ne příčinu.

---

## 12. Reporty (bez AI, `core/reports`)

**Týdenní:** počet tréninků, pracovní série, vývoj výkonu, nové PR, největší zlepšení, možná stagnace, objem svalů (direct/indirect).
**Měsíční:** porovnání s předchozím měsícem, vývoj síly a objemu, pravidelnost, největší posuny, oblasti vyžadující pozornost.
Při nedostatku dat (např. < 3 tréninky) report napíše „málo dat“ místo závěrů. AI může jen doplnit interpretaci nad hotovými čísly.

---

## 13. AI Coach (lokální, volitelný)

**Hlavní zásada:** čísla počítá `core/`; AI jen vysvětluje a interpretuje. Bez AI aplikace funguje celá.

### 13.1 Ověřené informace o modelech (Ollama, katalog ollama.com, načteno v tomto projektu)
- `gemma4` v katalogu existuje: tagy `e2b` (stažení cca 4,6–7,5 GB), `e4b` (cca 6,6–9,5 GB), dále `12b`, `26b`, `31b`.
- Kontext 128K u E2B/E4B. Stránka uvádí nativní volání funkcí. **Strukturovaný JSON výstup se na stránce neuvádí**, spolehlivost nutno vyzkoušet a výstup validovat ručně.
- Doporučené parametry z popisu: teplota 1,0, top_p 0,95, top_k 64.
- Čísla velikostí jsou z externí stránky a mohou se měnit. Nezahrnovat je do kódu.

### 13.2 Připojení (rozhodnutí č. 4)
Stav: statická PWA nemá server, takže volání jde přímo z prohlížeče.

| Scénář | Stav |
|---|---|
| Mac + Chrome, Ollama na `127.0.0.1:11434` | Pravděpodobně funguje po nastavení `OLLAMA_ORIGINS` na vaši doménu. **Neověřeno**, Chrome mění pravidla pro přístup na lokální síť. |
| Mac + Safari | **Neověřeno.** |
| iPhone → Ollama na Macu | HTTPS stránka nemůže volat `http://` adresu (mixed content). **Neověřeno**, pravděpodobně blokováno. |

**Možná řešení pro iPhone (nutno vyzkoušet):**
1. Malá lokální „bridge“ aplikace na Macu s HTTPS (např. přes Tailscale Serve s certifikátem, **neověřeno**), dostupná jen z vaší privátní sítě. Přidává nástroj navíc.
2. AI jen na Macu, iPhone zobrazí „lokální trenér není dostupný“. **Doporučeno jako první verze.**

**Bezpečnost:** žádný wildcard CORS, URL Ollamy konfigurovatelná v Nastavení, aplikace povolí jen adresu z nastavení (ne libovolnou zadanou v dotazu), timeout, omezená délka požadavků, žádné odesílání dat mimo vaše zařízení.

### 13.3 Funkce
- **Daily Coach:** doporučení pro dnešní trénink.
- **Progress Analysis:** analýza 4–8 týdnů.
- **Problem Solver:** příčiny stagnace a poklesu (jako hypotézy).
- **Training Advisor:** návrhy úprav plánu (vždy ke schválení).
- **Chat:** volná konverzace s lokální historií, nový chat, smazání, pokračování tématu, kontextové shrnutí místo celé historie.

### 13.4 `buildCoachContext(kind, params)`
Vrací malý strukturovaný objekt dle typu dotazu (ne celou databázi): cíl, cvik(y), posledních N tréninků po sériích, e1RM trend, stav z engine, objem svalů, PR, volitelně recovery. Pevný limit velikosti kontextu, minimalizace osobních dat (bez jména, e-mailu).

### 13.5 Struktura odpovědi (validovaná)
```json
{ "summary": "", "exercise": "", "recommendation": { "weight": 0, "sets": 0, "repRange": "" },
  "reason": "", "confidence": "low|medium|high", "warnings": [], "dataUsed": [], "facts": [], "hypotheses": [] }
```
Neplatný formát → bezpečná chybová odpověď bez zobrazení interních detailů. AI odpovídá česky, odděluje fakta od hypotéz, přiznává nedostatek dat, nevymýšlí výsledky ani citace.

---

## 14. Design

**Zachovat identitu:** tmavý režim, černé pozadí, tmavě šedé karty, měděný akcent (`#d9782d` tmavý, `#c4651a` světlý), tmavý text na akcentních tlačítkách, Barlow + Barlow Condensed, velká zaoblení, jednoduché ikony.

**Tokeny:** barvy (bg, card, line, text, muted, accent, ok, warn, danger), rozestupy 4/8/12/16/24, poloměry, velikosti písma, minimální dotykový cíl 44 px.

**Komponenty (design systém jako první):** Button (primary, soft, ghost, danger), Card, ListItem, Chip, Segmented, Sheet (spodní panel), Dialog, Toast, Stepper, Keypad, ChartCard (jednotný rámeček pro grafy s titulkem, období a prázdným stavem), StatTile, TrendBadge, EmptyState, ConfidenceBadge.

**Pravidla pro grafy:** jednotné osy a barvy napříč aplikací; tooltip; prázdný stav; nespolehlivá data vizuálně odlišená (přerušovaně); max jeden hlavní graf na kartu; dobrá čitelnost na 390 px šířky.

**Jazyk:** čeština jako výchozí od začátku; všechny texty ve slovníku, ne v kódu.

**Přístupnost:** kontrast ≥ 4,5:1, ikony s popisky pro čtečku, reakce na `prefers-reduced-motion`.

Pozadí (vrstevnice a podobně): uživatel vyzkoušel několik možností a žádnou nepovažoval za dobrou; v nové aplikaci **jen čisté pozadí**, dokud sám nenavrhne jiné.

---

## 15. Správa dat

- Export JSON (úplný) a CSV (kompatibilní se Strong). Import obou.
- **Import z původní aplikace:** nahrát její zálohu (`exportBackup`), zachovat ID tréninků a cviků, namapovat RPE → RIR, slít duplicity přes `aliases`.
- Automatické denní snapshoty (omezený počet), snapshot před importem, resetem, slučováním a migrací.
- Připomínka zálohy.
- Nastavení: jednotky, grafy, cíle, Ollama URL + test připojení + výběr modelu, správa chatů, synchronizace.

---

## 16. Roadmapa

| Etapa | Obsah | Hotovo, když |
|---|---|---|
| 0 | Rozhodnutí v sekci 18, vzorová data (anonymizovaný export), kostra projektu, design tokeny | repozitář sestaví, testy běží |
| 1 | Úložiště, migrace, snapshoty, import z původní aplikace a Strongu | všech 326 tréninků po importu sedí v počtech a součtech |
| 2 | `core/metrics`, `records`, `muscles` s testy | výpočty shodné s původní aplikací na vzorových datech |
| 3 | Zápis tréninku (karta cviku, klávesnice, minulý výkon, časovač, obnovení) | celý trénink lze zapsat bez ztráty dat po zavření aplikace |
| 4 | Engine progrese zapojený do zápisu (návrhy ke schválení) | návrhy nesou důvod, jistotu a varování |
| 5 | Home, History, Exercises Library, Plans | funkční parita se stávající aplikací |
| 6 | Progress: Overview, Exercises, Muscles, PR | všechny metriky mají prázdné stavy a prokliky |
| 7 | Reporty týden/měsíc | reporty bez AI, při málo datech „málo dat“ |
| 8 | Recovery (volitelné) | zápis pod 10 s |
| 9 | Ollama klient, test připojení | aplikace funguje i bez Ollamy |
| 10 | AI Coach + chat + historie | validace odpovědí, žádný automatický zápis |
| 11 | Volitelně sync Supabase, ověření schématu | sync neovlivní lokální funkčnost |
| 12 | Dokumentace, ladění, výkon | testy zelené, kontrola na reálném iPhonu |

**Pravidlo etap:** po každé etapě spustit testy, ověřit na emulovaném mobilu a ukázat výsledek, než se pokračuje. Nejdřív etapy 0–7: ty tvoří plně použitelnou aplikaci bez AI.

---

## 17. Rizika

| Riziko | Opatření |
|---|---|
| Ztráta dat při migraci | snapshot před každou migrací, testy s reálnými daty |
| iOS omezení PWA | ověřit na reálném zařízení brzy (etapa 3) |
| Rozcházení výpočtů mezi moduly | jediný zdroj pravdy v `core/` |
| Falešné závěry při málo datech | minimální počty expozic, štítek jistoty |
| Malý model dává špatné odpovědi | AI jen interpretuje hotová čísla, validace, vždy možnost AI nepoužít |
| Příliš velký rozsah | první verze bez AI a bez sync |
| Heuristiky vydávané za pravidla | označit v UI i dokumentaci |

---

## 18. Rozhodnutí potřebná před startem

1. **Platforma:** PWA (doporučeno) / nativní iOS / PWA + Capacitor.
2. **Úložiště:** normalizované IndexedDB tabulky (Dexie, nová závislost) vs. zachovat model jednoho dokumentu.
3. **RIR jako hlavní pole** (doporučeno) vs. zůstat u RPE.
4. **AI:** jen Mac (doporučeno pro v1) vs. i iPhone (vyžaduje HTTPS bridge, neověřeno).
5. **Sync:** hned od začátku vs. až po etapě 7; sync chatů a recovery ano/ne.
6. **Jazyk:** čeština jako jediný jazyk v1 (doporučeno).
7. **Navigace:** Progress místo Exercises v dolní liště, Exercises do More (doporučeno).
8. **Název a doména** nové aplikace (nasazení na GitHub Pages zachovat?).

---

## 19. Úvodní zadání pro první session nové aplikace

> Vytvoř novou aplikaci podle `docs/new-app-spec.md`. Nejdřív jen etapa 0 a 1: kostra Vite + React + TypeScript, design tokeny, `core/` s prázdnou strukturou, úložiště a import záloh. Nic dalšího neimplementuj. Po dokončení ukaž shrnutí a čekej na schválení další etapy. Neinstaluj závislosti mimo schválený seznam. Zachovej data (snapshoty před každou migrací).
