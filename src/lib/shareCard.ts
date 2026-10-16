import type { Exercise, Settings, Workout } from '../types';
import { doneSetCount, e1rm, isWorkingSet, workoutDurationMs, workoutVolume } from './calc';
import { fmtDate, fmtDuration, fmtNum, fmtVolume, toDisplayWeight } from './format';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

/** Renders a 1080×1350 summary image of a workout (Instagram portrait size). */
export async function renderShareCard(
  w: Workout,
  exMap: Map<string, Exercise>,
  settings: Settings,
  extra: { prs: number; level: number; levelTitle: string; streak: number },
): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  try {
    await document.fonts?.load('900 40px "Nunito Variable"');
  } catch {
    /* fall back to system font */
  }
  const font = (weight: number, size: number) => `${weight} ${size}px "Nunito Variable", Nunito, system-ui, sans-serif`;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#ff8a3d');
  bg.addColorStop(0.55, '#ff4f8b');
  bg.addColorStop(1, '#7c5cff');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.arc(W - 80, 120, 300, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(120, H - 60, 220, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = font(900, 40);
  ctx.fillText('⚒️ SETSMITH', 70, 110);
  ctx.font = font(700, 32);
  ctx.globalAlpha = 0.85;
  ctx.fillText(fmtDate(w.startedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), 70, 160);
  ctx.globalAlpha = 1;
  ctx.font = font(900, 84);
  ctx.fillText(fit(ctx, w.name, W - 140), 70, 270);

  const unit = settings.unit;
  const stats: [string, string][] = [
    ['Délka', fmtDuration(workoutDurationMs(w))],
    ['Objem', fmtVolume(workoutVolume(w, exMap), unit)],
    ['Série', String(doneSetCount(w))],
    ['Rekordy', extra.prs ? `🏆 ${extra.prs}` : '–'],
  ];
  const boxW = (W - 140 - 3 * 24) / 4;
  stats.forEach(([label, value], i) => {
    const x = 70 + i * (boxW + 24);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, x, 320, boxW, 150, 32);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = font(900, 44);
    ctx.fillText(fit(ctx, value, boxW - 40), x + 24, 400);
    ctx.font = font(700, 26);
    ctx.globalAlpha = 0.85;
    ctx.fillText(label, x + 24, 445);
    ctx.globalAlpha = 1;
  });

  ctx.fillStyle = 'rgba(15,12,30,0.35)';
  roundRect(ctx, 70, 510, W - 140, 660, 40);
  ctx.fill();
  let y = 590;
  const items = w.exercises.slice(0, 7);
  for (const we of items) {
    const ex = exMap.get(we.exerciseId);
    if (!ex) continue;
    const working = we.sets.filter((s) => s.done && isWorkingSet(s));
    const best = working.reduce((b, s) => (e1rm(s.weight ?? 0, s.reps ?? 0) > e1rm(b?.weight ?? 0, b?.reps ?? 0) ? s : b), working[0]);
    ctx.fillStyle = '#fff';
    ctx.font = font(800, 36);
    ctx.fillText(fit(ctx, `${working.length}× ${ex.name}`, W - 480), 110, y);
    if (best) {
      const txt =
        best.weight && best.reps
          ? `${fmtNum(toDisplayWeight(best.weight, unit))} ${unit} × ${best.reps}`
          : best.reps
            ? `${best.reps} opak.`
            : best.durationSec
              ? `${Math.round(best.durationSec)} s`
              : '';
      ctx.font = font(900, 34);
      ctx.textAlign = 'right';
      ctx.fillText(txt, W - 110, y);
      ctx.textAlign = 'left';
    }
    y += 84;
  }
  if (w.exercises.length > items.length) {
    ctx.font = font(700, 30);
    ctx.globalAlpha = 0.8;
    ctx.fillText(`+ ${w.exercises.length - items.length} dalších cviků`, 110, y);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = '#fff';
  ctx.font = font(900, 34);
  ctx.fillText(`Level ${extra.level} · ${extra.levelTitle}`, 70, H - 90);
  if (extra.streak > 0) {
    ctx.textAlign = 'right';
    ctx.fillText(`🔥 ${extra.streak} týdnů v řadě`, W - 70, H - 90);
    ctx.textAlign = 'left';
  }

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}
