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
The estimate is marked **unreliable above 12 reps** (`E1RM_RELIABLE_MAX_REPS`, `e1rmReliable`). It is not used to judge progress (that uses the best set actually lifted). Different rep counts and different exercise variants are not compared as if they were the same.

## Muscles
- Each exercise has a load per muscle: prime movers 1, secondary muscles 0.5 by default, or custom values (`muscleLoad`).
- **Sets per muscle** = Σ over exercises of (finished working sets × load of that muscle). Warm-ups are ignored. These are weighted "fractional" sets, so a bench press set adds 1 to chest and 0.5 to triceps.
- A set is not counted as a full set for every muscle it touches.

## Records
`computeRecords` returns, over working sets only: heaviest weight, best e1RM, most reps, best single-set volume, best session volume, longest duration, longest distance and the heaviest weight for each rep count from 1 to 12. `detectPRs` compares a workout with all earlier ones; the first session of an exercise is a baseline and produces no record.

## Trend: improving, stagnation, decline (`core/progress/trend.ts`)
One definition used by the progress engine, the progress panel, the coach notes and the deload advice. It uses only what was actually lifted; the 1RM estimate plays no part in it.

**Best set of a session:** among the finished working sets with weight and reps, those that reached the bottom of the exercise's rep range (`repMin`, from the training focus or the exercise's own target); if none did, all of them. The best set is the heaviest of these, and at the same weight the one with most reps (`compareBest`). A single heavy set below the rep range is therefore not "the working set" of an 8 to 12 rep exercise.

**Position in the workout (slot):** each session records how many weighted working sets on the exercise's main muscles (load 0.75 or more) came earlier in that workout (`priorSets`, from `exerciseHistory(workouts, id, exMap)`). Three or more earlier sets means the lift was done after other work for the muscle (`fatigued`), fewer means `fresh`. Example: incline press first versus incline press after the bench press. A verdict only compares sessions in the same slot as the newest session (or as today's workout when advice is requested); if that slot has fewer than 5 sessions, all sessions are compared and the result is marked `mixed` with lower confidence. The three-sets limit is a **heuristic**.

| Constant | Value | Meaning |
|---|---|---|
| `recent` | 3 | Sessions that make up the window being judged |
| `baselineSessions` | 8 | The baseline is the best set of the 8 sessions just before the window, not the all-time best |
| `minBaseline` | 2 | Fewest earlier sessions before a plateau may be called (so at least 5 sessions in total) |
| `minSpanDays` | 14 | The window must cover at least this many days |
| `volumeTolerance` | 0.5 % | Work volume above the baseline's best by more than this counts as more work |
| `declineReps` | 2 | Three falling sessions need a lower weight, or this many fewer reps at the same weight |
| `fatiguedSets` | 3 | Earlier sets on the same muscles from which a lift counts as done after other work |

Result:
- **decline:** the best sets of the last three sessions each get worse than the one before, and the newest is lower than the oldest of the three by weight, or by 2 or more reps at the same weight.
- **improving:** the recent best set beats the baseline best set (heavier, or more reps at the same weight). If it does not but the work volume is clearly higher, the state is still improving and is labelled "more work".
- **stagnation:** neither the best set nor the volume beat the baseline, and the window spans 14 days or more.
- **insufficient:** fewer than 3 sessions, or fewer than 2 baseline sessions.

The change is reported as what really changed, for example "+2.5 kg" or "+1 rep", never as a percentage of an estimate. A single weak session never produces a verdict. A decline is not attributed to overtraining; the advice lists possible factors only. All thresholds are **heuristic**. The estimated 1RM is still shown elsewhere (exercise charts, records) but is not used to judge progress.

## Double progression (`core/progress/engine.ts`)
Target per exercise: rep range, number of sets, target RIR. Unless you set your own, the target is the range that follows your **training focus**, **body goal** and the **kind of exercise** (`targetForExercise`, table in "Rep range suggestions"). Changing the focus or the body goal changes the advice at once. The default focus comes from the profile goal unless chosen in Settings. A per-exercise target you set yourself overrides it.

Looking at the most recent session in the same slot as today's workout (at least 2 such sessions, otherwise all sessions), and its sets at the heaviest weight that reached the bottom of the rep range:
1. Needs at least 2 sessions, otherwise "insufficient".
2. Decline or stagnation from the trend (stagnation is ignored when every set already reached the top of the range).
3. **ready:** at least the target number of sets, every set at the top of the range. Add the increment and restart at the bottom of the range. If the last set was at or near failure (RIR below 1) the advice is to hold once instead. If every set had 3 or more reps in reserve the step is doubled.
4. **hold:** the weakest set is below the bottom of the range, stay at the weight until every set reaches it.
5. **building:** otherwise stay at the weight and aim for one more rep on every set (never above the top of the range).

Increment (`weightIncrement`): 5 kg for barbell leg lifts and deadlifts, 2 kg dumbbells, 4 kg kettlebells, 2.5 kg otherwise.

**RIR** is `10 − RPE` when RPE was logged. Missing RIR is never guessed; it lowers the confidence and adds a warning.

**Confidence:** one point for 5 or more sessions, one for a logged RIR. 2 points high, 1 medium, 0 low.

## Rep range suggestions (`core/progress/ranges.ts`)
Settings → **Body goal** (cutting, maintaining, bulking) and **Training focus** (strength, muscle, both). **More → Coach → Rep ranges for your routines** lists every weighted exercise in your routines with a suggested range, sets and RIR; you tick the ones to apply and confirm. Ranges you set yourself are left alone unless you tick them. Nothing is applied automatically, and the number of sets follows your own routine.

The suggestion depends on what the exercise is (`exerciseKind`), because that decides how heavy it makes sense to train it:
- **Heavy barbell lift:** barbell multi-joint lifts (squat, bench, deadlift, row, overhead press, hip thrust).
- **Compound lift:** other multi-joint lifts (dumbbell, machine and cable presses, rows, pulldowns, leg press, lunges).
- **Isolation:** one joint, a big muscle (curls, triceps extensions, leg extension and curl, flyes, hip abduction).
- **Small-muscle isolation:** one joint, a small or light-load muscle (side and rear delts, calves, forearms, core), done with higher reps.

Multi-joint is read from the muscle loads: three or more muscles at half load or more (forearms do not count, they only grip), or two at three quarters, or a leg exercise with two big muscles. A few exercises are corrected by hand (the decline bench press is heavy). The type is shown next to every exercise in the suggestions and in the progression target.

| Focus | Heavy | Compound | Isolation | Small muscle |
|---|---|---|---|---|
| Strength | 3–6 | 5–8 | 8–12 | 8–12 |
| Both | 4–8 | 6–10 | 8–12 | 10–15 |
| Muscle | 6–10 | 8–12 | 10–15 | 12–20 |

The higher reps for small muscles are practice (light loads, little systemic fatigue), not a finding of the studies below.

Body goal: bulking and maintaining use the table as is; **cutting moves both ends down by 2 reps** (never below 3). RIR target 2, except 1 for non-heavy lifts when bulking.

What the evidence says, and how far it goes:
- Muscle growth is similar across low, moderate and high loads when sets are taken to or near failure; strength is better with heavier loads ([Lopez 2021](https://pubmed.ncbi.nlm.nih.gov/33433148/), [Schoenfeld 2017](https://pubmed.ncbi.nlm.nih.gov/28834797/)). So the rep range mostly follows strength priority and the fatigue and joint cost of the exercise, which is why heavy barbell lifts sit lowest and isolation highest. That last part is practice, not a finding.
- In an energy deficit, lean mass gains are impaired while strength gains are comparable ([Murphy and Koehler 2022](https://pubmed.ncbi.nlm.nih.gov/34623696/)). Intensity appears to be the key variable for maintaining performance even when volume and frequency drop ([Spiering 2021](https://pubmed.ncbi.nlm.nih.gov/33629972/)). A review of volume in a deficit found the evidence insufficient to say more volume protects lean mass ([Roth 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9012799)). Hence "keep the load, move the range down, holding weights counts as progress when cutting". The two-rep shift is a heuristic.
- Training to failure is not clearly better than stopping short of it ([Refalo 2023](https://pubmed.ncbi.nlm.nih.gov/36334240/)), hence RIR 1–2 rather than 0.

These sources were read as abstracts and summaries, not in full. The specific ranges and the shifts are rules of thumb built on them, not published prescriptions.

## Suggestion for the next workout (`suggestNext` in `lib/calc.ts`)
Order of checks for a weight-and-reps exercise:
1. Not done for more than 28 days: restart at 90 % (heuristic).
2. 14–28 days off, sets held and not a grind: repeat the weight (heuristic).
3. Stagnation or decline by the trend (judged in today's slot) and the last session did not hold its reps: deload to 90 %.
4. Otherwise the double progression result above.

Then overlays that turn an increase into "repeat" (the training focus matters here too):
- 8 or more weighted sets already done earlier today on the same muscle;
- the exercise is the 4th or later in the workout and a compound lift: keep the weight and add one rep. Strength gains are reported to be larger for exercises done earlier, hypertrophy appears not to depend on order, so this rule is **skipped when the focus is muscle (hypertrophy)** and applies for strength and both;
- 14 or more weighted sets for the muscle in the previous 72 hours.

Bodyweight-only, duration and assisted exercises have their own simple rules (one more rep, 5 more seconds, less assistance).

## Reports and insights
- **Coach notes** (`lib/insights.ts`, up to 3): muscles trained regularly (at least 6 weighted sets a week over 4 weeks) but under 10 in the last 7 days; one muscle above 20 in 7 days; one stagnating exercise from the trend. About 10 weighted sets a week per muscle is a common orientation for growth, with diminishing returns beyond roughly 20; with a **strength focus** the floor is lowered to 6 (heuristic). These are orientations, not personal targets.
- **Progress panel** (`lib/overload.ts`, `components/OverloadPanel.tsx`): state from the trend, change as kilograms or reps, a chart of the best set with separate lines for sessions done first and after other work, and the best set of the last sessions.
- Not implemented yet: weekly and monthly reports, an AI explanation layer.

## Sources and caution
The ranges and rules above follow common coaching practice (double progression, RPE/RIR autoregulation, weekly set ranges). The specific studies mentioned in discussion were summarised from abstracts and are not cited here; check a source before relying on any number as a rule. No study is a universal rule.
