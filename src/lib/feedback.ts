let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a user gesture so iOS allows sound later. */
export function unlockAudio() {
  audio();
}

export function beep(times = 3) {
  const a = audio();
  if (!a) return;
  for (let i = 0; i < times; i++) {
    const t = a.currentTime + i * 0.25;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.frequency.value = i === times - 1 ? 1100 : 880;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

export function vibrate(pattern: number | number[] = [200, 100, 200]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

export function download(filename: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Shows a system notification. Installed iOS apps only allow this through the service worker. */
export async function notify(title: string, body: string, tag = 'rest') {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, icon: './icon-192.png', badge: './icon-192.png' });
    else new Notification(title, { body, tag });
  } catch {
    /* ignore */
  }
}

/** Asks once, from a tap, so rest-over alerts can reach the user while the app is in the background. */
export function askNotificationsOnce() {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    if (localStorage.getItem('gym-asked-notifications')) return;
    localStorage.setItem('gym-asked-notifications', '1');
    void Notification.requestPermission();
  } catch {
    /* ignore */
  }
}
