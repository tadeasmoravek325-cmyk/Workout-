import { useStore } from '../store/store';

/** Short vibration for tactile feedback (respects settings). */
export function haptic(pattern: number | number[] = 12) {
  if (!useStore.getState().settings.vibrate) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
