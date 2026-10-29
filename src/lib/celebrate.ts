import { useStore } from '../store/store';

/** iPhones have no navigator.vibrate. Flipping a hidden switch input gives a tick on iOS 17.4+ Safari. */
function iosTick() {
  try {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-100px;top:-100px;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.body.appendChild(label);
    label.click();
    setTimeout(() => label.remove(), 100);
  } catch {
    /* unsupported */
  }
}

/** Short vibration for tactile feedback (respects settings). */
export function haptic(pattern: number | number[] = 12) {
  if (!useStore.getState().settings.vibrate) return;
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
    else iosTick();
  } catch {
    /* unsupported */
  }
}
