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
Settings per exercise (open an exercise → Target tab): working **sets**, **min** and **max** reps, **target RIR**, **start weight** and **increment** (kg). Exercises you do not change follow the training focus, body goal and exercise type (see "Rep range suggestions"); the increment defaults by exercise (5 kg barbell leg lifts and deadlifts, 2 kg dumbbells, 4 kg kettlebells, 2.5 kg otherwise). The start weight is used as the first suggestion when an exercise has no history.

The engine looks at the most recent session in the same position as today's workout, at its working weight (the heaviest weight that reached the bottom of the range, with every working set at that weight, including sets below the range). It works from a single session; confidence is low when there is little history or no RIR. Checks run in this order and the first that applies decides:

1. **Decline** (best set worse three sessions in a row, see trend): keep the weight, warn of possible fatigue.
2. **Stagnation** (no better set for 5+ sessions over 14+ days, unless the top was just reached): keep the weight.
3. **D – repeated failure:** two or more of the last three sessions had a set to failure (RIR 0 or a set marked failure): keep the weight, flag high intensity, point to recovery (sleep, food, the other workouts for the muscle). No automatic increase.
4. **C – too little:**
   - below the minimum reps in two sessions in a row at the same weight: suggest the weight lowered by one increment and aim for min+1 reps (state `reduce`), warn of fatigue;
   - below the minimum once, or total reps fell by more than 20 % since the last session at the same weight: keep the weight, aim for one more rep on each set, warn of fatigue.
5. **B – top of the range:** every target set reached the top (at least the target number of sets). If RIR was logged and the lowest is below the target RIR, repeat the weight; otherwise add the increment (double when every set had 3 or more reps in reserve and more than the target) and aim for the bottom of the range, e.g. 8–10 of 8–12. Without RIR the increase is still advised, with lower confidence.
6. **A – not at the top on every set:** keep the weight and aim for one more rep on **each** set, within the range: 10 / 9 / 8 becomes 11 / 10 / 9.

Technique is not recorded in the app, so it cannot be part of the rule.

**Other exercise types** (every type except distance and cardio has a Target tab):
- **Weighted bodyweight** (pull-up, dip, back extension): the same rules, the weight is the added load and may be zero. Reaching the top with no added weight advises adding the increment.
- **Reps only** (push-up, crunch, sit-up): the same rules without a load. At the top of the range on every set the advice is to make it harder (add weight or a harder variation) and start the range again; below the minimum twice in a row it advises an easier variation. No start weight or increment.
- **Assisted** (assisted pull-up): the weight is the assistance. Reaching the top asks for less assistance (the assistance step is the increment); falling below the minimum twice in a row asks for more.
- **Holds** (plank): the range is in seconds (default 30–60) with a step (default 5 s). Each set aims a step higher than last time, capped at the top; at the top of every set the advice is to make it harder.
- The trend (stagnation, decline) is not applied to assisted lifts; the other rules apply to all of them.

Overlays that turn an increase into "repeat the weight at the top of the range" are described under "Suggestion for the next workout". **RIR** is `10 − RPE` when RPE was logged; missing RIR is never guessed and lowers confidence and adds a warning. **Confidence:** one point for 5 or more sessions, one for a logged RIR; 2 points high, 1 medium, 0 low (one level lower when there is no session in the same position).

**During the workout** (`core/progress/live.ts`) each finished working set is judged against the range (below, inside, top; reserve against the target; failure) and the exercise as a whole gets one sentence: a set below the minimum, a set to failure, top of the range on every set with the target reserve ("add weight next time"), or how many sets are left. Reps below the minimum are shown in red and reps at the top in the accent colour. Nothing is written; the suggested reps for each set are placeholders you can apply.

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

**The focus is a recommendation, not a rule.** Some exercises have a natural range of their own that the focus does not override: deadlifts stay at 3–6 reps, romanian deadlifts and good mornings at 6–10, hip thrusts 6–12, calves 12–20, shrugs 8–15, side and rear delts and face pulls 12–20, forearms 12–20, leg extension and leg curl 10–15, flyes and pullovers 10–15, arm isolation 8–15, core 10–20. For these the focus only nudges the range by one rep (lower for strength, higher for muscle) and the body goal shifts it as below. These ranges are common practice, not findings of the studies cited below.

A recommended range is also a guide: a set one rep under the bottom still counts as inside it (`tolerance` 1). A range you set yourself in the exercise's Target tab is strict. The Target tab explains why an exercise has the range it has.

Body goal: bulking and maintaining use the table as is; **cutting moves both ends down by 2 reps** (never below 3). RIR target 2, except 1 for non-heavy lifts when bulking.

What the evidence says, and how far it goes:
- Muscle growth is similar across low, moderate and high loads when sets are taken to or near failure; strength is better with heavier loads ([Lopez 2021](https://pubmed.ncbi.nlm.nih.gov/33433148/), [Schoenfeld 2017](https://pubmed.ncbi.nlm.nih.gov/28834797/)). So the rep range mostly follows strength priority and the fatigue and joint cost of the exercise, which is why heavy barbell lifts sit lowest and isolation highest. That last part is practice, not a finding.
- In an energy deficit, lean mass gains are impaired while strength gains are comparable ([Murphy and Koehler 2022](https://pubmed.ncbi.nlm.nih.gov/34623696/)). Intensity appears to be the key variable for maintaining performance even when volume and frequency drop ([Spiering 2021](https://pubmed.ncbi.nlm.nih.gov/33629972/)). A review of volume in a deficit found the evidence insufficient to say more volume protects lean mass ([Roth 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9012799)). Hence "keep the load, move the range down, holding weights counts as progress when cutting". The two-rep shift is a heuristic.
- Training to failure is not clearly better than stopping short of it ([Refalo 2023](https://pubmed.ncbi.nlm.nih.gov/36334240/)), hence RIR 1–2 rather than 0.

These sources were read as abstracts and summaries, not in full. The specific ranges and the shifts are rules of thumb built on them, not published prescriptions.

## Suggestion for the next workout (`suggestNext` in `lib/calc.ts`)
Order of checks for a weight-and-reps exercise:
0. No history: the start weight you set, if any.
1. Not done for more than 28 days: restart at 90 % (heuristic).
2. 14–28 days off, sets held and not a grind: repeat the weight (heuristic).
3. Stagnation or decline by the trend (judged in today's slot) and the last session did not hold its reps: deload to 90 %.
4. Otherwise the double progression result above.

Then overlays that turn an increase into "repeat the weight at the top of the range" (the training focus matters here too):
- 8 or more weighted sets already done earlier today on the same muscle;
- the exercise is the 4th or later in the workout and a compound lift: keep the weight and repeat the top reps. Strength gains are reported to be larger for exercises done earlier, hypertrophy appears not to depend on order, so this rule is **skipped when the focus is muscle (hypertrophy)** and applies for strength and both;
- 14 or more weighted sets for the muscle in the previous 72 hours.

Bodyweight-only, duration and assisted exercises have their own simple rules (one more rep, 5 more seconds, less assistance).

## Reports and insights
- **Coach notes** (`lib/insights.ts`, up to 3): muscles trained regularly (at least 6 weighted sets a week over 4 weeks) but under 10 in the last 7 days; one muscle above 20 in 7 days; one stagnating exercise from the trend. About 10 weighted sets a week per muscle is a common orientation for growth, with diminishing returns beyond roughly 20; with a **strength focus** the floor is lowered to 6 (heuristic). These are orientations, not personal targets.
- **Progress panel** (`lib/overload.ts`, `components/OverloadPanel.tsx`): state from the trend, change as kilograms or reps, a chart of the best set with separate lines for sessions done first and after other work, and the best set of the last sessions.
- Not implemented yet: weekly and monthly reports, an AI explanation layer.

## Sources and caution
The ranges and rules above follow common coaching practice (double progression, RPE/RIR autoregulation, weekly set ranges). The specific studies mentioned in discussion were summarised from abstracts and are not cited here; check a source before relying on any number as a rule. No study is a universal rule.
