import confetti from 'canvas-confetti';
import { useStore } from '../store/store';

const COLORS = ['#ff7a1a', '#ff4a1a', '#ffa030', '#ffc65c', '#ffffff', '#2c2c2c'];

function reduced() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Big two-sided confetti burst for finishing a workout or levelling up. */
export function bigConfetti() {
  if (reduced()) return;
  const end = Date.now() + 900;
  const frame = () => {
    confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.75 }, colors: COLORS, zIndex: 300 });
    confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.75 }, colors: COLORS, zIndex: 300 });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

/** Small burst, e.g. for a personal record. */
export function smallConfetti(y = 0.2) {
  if (reduced()) return;
  confetti({ particleCount: 60, spread: 80, startVelocity: 35, origin: { y }, colors: COLORS, scalar: 0.9, zIndex: 300 });
}

/** Short vibration for tactile feedback (respects settings). */
export function haptic(pattern: number | number[] = 12) {
  if (!useStore.getState().settings.vibrate) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
