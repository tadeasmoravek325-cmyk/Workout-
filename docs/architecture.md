# Architecture

State of the app after the refactor stages 0–5 (Stage 6, the optional AI explanation, was skipped; there is no AI code in the app).

## Stack
Vite · React 18 · TypeScript · `vite-plugin-pwa` · HashRouter · Zustand (UI and persisted state) · IndexedDB via `idb-keyval` · Recharts · optional Supabase sync. Static site on GitHub Pages (deployed from `main`; CI runs `npm test` and `npm run build`).

## Layout
```
src/
  core/              Pure training maths. No React, no storage, no clock.
    metrics.ts       Working sets, volume, e1RM and its reliability flag.
    history.ts       Session list for one exercise.
    records.ts       Personal records and PR detection.
    muscles.ts       Weighted sets per muscle.
    progress/
      trend.ts       The single definition of improving / stagnation / decline.
      engine.ts      Double progression advice with confidence and warnings.
      increment.ts   Smallest sensible load jump per exercise.
  lib/               App logic around the core: calc.ts (suggestions, streaks, plates), periods, insights,
                     overload, sync, backup/safety, csv import, gamification.
  store/store.ts     Zustand store with `persist`.
  pages/, components/  UI.
  data/              Built-in exercise catalogue and programs.
e2e/                 Playwright smoke test (local only).
private/             Your real backup and reference numbers. Git-ignored. Never commit.
```
`lib/calc.ts` re-exports the `core/` functions, so older imports keep working.

### Rules for `core/`
- Imports only from other `core/` files and `types`.
- Two small, deliberate exceptions: `core/muscles.ts` reads the static exercise catalogue (`muscleLoad`), and `core/progress/engine.ts` produces user-facing text through `t()` from `i18n`.
- Every definition lives in one place. If a screen needs a number the core already has, it calls the core; it does not recompute it.

## Data and storage
- All data is one object persisted by Zustand under the key `silak-data` in IndexedDB. The key keeps the original working name so existing data is not lost. Schema version is 1, `migrate` returns the state untouched (there have been no breaking changes).
- **Write coalescing:** `coalescedJsonStorage` (in `lib/safety.ts`) combines bursts of changes into one write after 300 ms. Pending data is written at once on `visibilitychange` (hidden) and `pagehide`. The stored format is identical. Measured on 335 workouts (about 1 MB): a change cost about 22 ms before (6× slowed CPU) and about 0.5 ms after.
- **Safety net** (`lib/safety.ts`): nothing is written until data has loaded successfully; unreadable data is copied aside ("quarantine"); automatic daily snapshots plus snapshots before import, reset, restore and exercise merging; `navigator.storage.persist()` is requested; changes are announced between tabs.
- **Sync** (optional, Supabase): records are merged per item, last writer wins, deletions are tombstones. Settings, schedule and exercise notes travel as documents. The app works fully without it.
- Weights are always stored in kg; the unit setting only changes display.
- Set intensity is stored as RPE (optional). RIR is derived as `10 − RPE` and never stored separately.

## Progress pipeline
```
exerciseHistory ──► trendPoints ──► analyzeTrend ──┬─► progress engine ─► suggestNext ─► "Today" card
 (core/history)      (core/trend)    (core/trend)  ├─► progress panel (overload.ts)      (lib/calc.ts)
                                                   ├─► coach notes (insights.ts)
                                                   └─► deload advice inside suggestNext
```
Suggestions are advice only. Nothing writes to a workout or routine until the user taps Apply.

## Testing
- `npm test`: Vitest, pure functions and storage logic (165 tests at the time of writing).
- `npm run test:e2e`: Playwright smoke test on an emulated iPhone running Chromium (logs a workout, reloads, finishes it, checks history). Not part of CI because CI has no browsers. It does not cover Safari-specific behaviour.
- **Reference snapshot** (local): put a backup file at `private/backup.json` and run `REF_WRITE=1 npx vitest run reference`. It writes `private/reference-before.json` with counts, volumes, records, set counts per muscle, trend states and suggestions. Later runs of `npx vitest run reference` compare against it. Any intended change in results shows up as a diff to review.

## Known gaps
- `lib/calc.ts` still reads the clock in a few places (`muscleRecovery`, `workoutDurationMs`); `suggestNext` takes `now` as a parameter.
- `WorkoutEditor` keeps its own "new record" and "improvement" markers next to `computeRecords`.
- `RoutineEditor` computes planned volume with its own formula (it describes a plan, not logged sets).
- No native haptics or reliable background timers on iOS (PWA limits).
- Texts are English only; there is no Czech dictionary yet.
