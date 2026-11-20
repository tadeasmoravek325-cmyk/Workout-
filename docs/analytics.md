# Analytics: definitions and formulas

Everything here is implemented in `src/core/` and covered by tests. Thresholds marked **heuristic** are rules of thumb chosen for this app, not published standards.

## Sets
| Term | Definition | Code |
|---|---|---|
| Working set | Any set that is not a warm-up. Drop sets and sets to failure count as working. | `isWorkingSet` |
| Logged working set | Finished, working, and something was logged (reps, time or distance). Empty ticked rows do not count. | `isLoggedWorkingSet` |
| Finished working sets | `done` and working. Used for set counts per muscle. | `countWorkingSets` |

## Volume
- **Volume load of a set** = weight × reps, only when the set is finished. Assisted bodyweight, duration and distance exercises have no volume load.
- **General volume** (Home, History, Stats, workout detail) includes warm-ups: `setVolume`, `workoutVolume`.
- **Work volume** (used when measuring progress) excludes warm-ups: `workSetVolume`.
- Volume load is work done in kilograms lifted. It is not a measure of muscle growth and is never presented as one. Strength (e1RM, working weight), work done (volume) and dose (set counts) are kept apart.

## Estimated 1RM
`e1RM = weight × (1 + min(reps, 15) / 30)` (Epley); one rep returns the weight itself.
The estimate is marked **unreliable above 12 reps** (`E1RM_RELIABLE_MAX_REPS`, `e1rmReliable`). In the progress panel such values carry a "≈". Different rep counts and different exercise variants are not compared as if they were the same.

## Muscles
- Each exercise has a load per muscle: prime movers 1, secondary muscles 0.5 by default, or custom values (`muscleLoad`).
- **Sets per muscle** = Σ over exercises of (finished working sets × load of that muscle). Warm-ups are ignored. These are weighted "fractional" sets, so a bench press set adds 1 to chest and 0.5 to triceps.
- A set is not counted as a full set for every muscle it touches.

## Records
`computeRecords` returns, over working sets only: heaviest weight, best e1RM, most reps, best single-set volume, best session volume, longest duration, longest distance and the heaviest weight for each rep count from 1 to 12. `detectPRs` compares a workout with all earlier ones; the first session of an exercise is a baseline and produces no record.

## Trend: improving, stagnation, decline (`core/progress/trend.ts`)
One definition used by the progress engine, the progress panel, the coach notes and the deload advice.

Per session (newest first): the best e1RM and the work volume of weighted working sets.

| Constant | Value | Meaning |
|---|---|---|
| `recent` | 3 | Sessions in the window being judged |
| `baselineSessions` | 8 | The baseline is the best of the 8 sessions just before the window, not the all-time best |
| `minBaseline` | 2 | Fewest earlier sessions before a plateau may be called (so at least 5 sessions in total) |
| `tolerance` | 0.5 % | A recent best within this of the baseline counts as no improvement |
| `minSpanDays` | 14 | The window must cover at least this many days |
| `declineDrop` | 3 % | Total fall needed for a decline |

Result:
- **decline:** the last three sessions fall strictly one after another and lose more than 3 % in total.
- **stagnation:** neither the best e1RM nor the volume of the window beat the baseline (within tolerance), the window spans 14 days or more.
- **improving:** otherwise.
- **insufficient:** fewer than 3 sessions, or fewer than 2 baseline sessions.

A single weak session never produces a verdict. A decline is not attributed to overtraining; the advice lists possible factors only (fatigue, sleep or recovery, plan or exercise order changes). All thresholds are **heuristic**.

## Double progression (`core/progress/engine.ts`)
Target per exercise: rep range, number of sets, target RIR. Defaults follow the training focus: strength 3–6 reps × 4, muscle 8–12 × 3, both 6–10 × 3, RIR 2. The default focus comes from the profile goal unless chosen in Settings. A per-exercise target overrides it.

Looking at the most recent session's sets at its heaviest working weight:
1. Needs at least 2 sessions, otherwise "insufficient".
2. Decline or stagnation from the trend (stagnation is ignored when every set already reached the top of the range).
3. **ready:** at least the target number of sets, every set at the top of the range. Add the increment and restart at the bottom of the range. If the last set was at or near failure (RIR below 1) the advice is to hold once instead. If every set had 3 or more reps in reserve the step is doubled.
4. **hold:** the weakest set is below the bottom of the range, stay at the weight until every set reaches it.
5. **building:** otherwise stay at the weight and aim for one more rep on every set (never above the top of the range).

Increment (`weightIncrement`): 5 kg for barbell leg lifts and deadlifts, 2 kg dumbbells, 4 kg kettlebells, 2.5 kg otherwise.

**RIR** is `10 − RPE` when RPE was logged. Missing RIR is never guessed; it lowers the confidence and adds a warning.

**Confidence:** one point for 5 or more sessions, one for a logged RIR. 2 points high, 1 medium, 0 low.

## Suggestion for the next workout (`suggestNext` in `lib/calc.ts`)
Order of checks for a weight-and-reps exercise:
1. Not done for more than 28 days: restart at 90 % (heuristic).
2. 14–28 days off, sets held and not a grind: repeat the weight (heuristic).
3. Stagnation or decline by the trend and the last session did not hold its reps: deload to 90 %.
4. Otherwise the double progression result above.

Then overlays that turn an increase into "repeat":
- 8 or more weighted sets already done earlier today on the same muscle;
- the exercise is the 4th or later in the workout and a compound lift: keep the weight and add one rep (strength gains are reported to be larger for exercises done earlier; hypertrophy appears not to depend on order, so this is an approximation);
- 14 or more weighted sets for the muscle in the previous 72 hours.

Bodyweight-only, duration and assisted exercises have their own simple rules (one more rep, 5 more seconds, less assistance).

## Reports and insights
- **Coach notes** (`lib/insights.ts`, up to 3): muscles trained regularly (at least 6 weighted sets a week over 4 weeks) but under 10 in the last 7 days; one muscle above 20 in 7 days; one stagnating exercise from the trend. About 10 weighted sets a week per muscle is a common orientation for growth, with diminishing returns beyond roughly 20. These are orientations, not personal targets.
- **Progress panel** (`lib/overload.ts`): state from the trend, change in percent as recent best against baseline best.
- Not implemented yet: weekly and monthly reports, an AI explanation layer.

## Sources and caution
The ranges and rules above follow common coaching practice (double progression, RPE/RIR autoregulation, weekly set ranges). The specific studies mentioned in discussion were summarised from abstracts and are not cited here; check a source before relying on any number as a rule. No study is a universal rule.
