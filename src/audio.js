// Sound + notification helpers.
//   open.mp3   → app opens + every System notification window
//   quest.mp3  → quest / button blip
//   alert.mp3  → "test sound" button only
// Browsers block audio until the first touch/click, so the open sound is queued and played the
// moment the first gesture happens (and again whenever the app comes back to the foreground).
let soundOn = true;
let lastSfxAt = 0;
let openPending = true;   // the app-open sound has not been heard yet
let unlocked = false;
let lastOpenAt = -1e9;

const make = (src, volume) => {
  try { const a = new Audio(src); a.preload = 'auto'; a.volume = volume; return a; } catch (e) { return null; }
};
let openAudio = null;
let alertAudio = null;
let questAudio = null;
function ensure() {
  if (!openAudio) openAudio = make('./open.mp3', 1);
  if (!questAudio) questAudio = make('./quest.mp3', 0.82);
  if (!alertAudio) alertAudio = make('./alert.mp3', 0.78);
}

export const setSoundOn = (v) => { soundOn = !!v; };

function play(audio) {
  if (!audio) return Promise.resolve(false);
  try {
    audio.pause(); audio.currentTime = 0;
    const p = audio.play();
    if (p && p.then) return p.then(() => true).catch(() => false);
    return Promise.resolve(true);
  } catch (e) { return Promise.resolve(false); }
}

// The open chime. If the browser refuses (no gesture yet) it stays queued for the first tap.
export function playOpen() {
  ensure();
  if (!soundOn) return Promise.resolve(false);
  const now = performance.now();
  if (now - lastOpenAt < 900) return Promise.resolve(true); // don't stutter when two triggers land together
  return play(openAudio).then((ok) => { if (ok) { openPending = false; unlocked = true; lastOpenAt = performance.now(); } return ok; });
}

export function sfx(kind = 'tap') {
  ensure();
  if (!soundOn || ['tap', 'touch', 'check'].includes(kind)) return;
  if (kind === 'quest' || kind === 'checkbox') {
    const now = performance.now();
    if (now - lastSfxAt < 140) return;
    lastSfxAt = now;
    play(questAudio);
    return;
  }
  if (kind === 'testalert') { play(alertAudio); return; }
  // every other kind (alert, level, claim, penalty, open …) = the System window chime
  playOpen();
}

// Every enabled button gives the short quest blip after its own action.
export function buttonBlip() {
  ensure();
  if (!soundOn) return;
  play(questAudio);
}

// Call on first user gesture / when the app returns to the foreground.
export function tryAppOpenSound() {
  ensure();
  if (openPending && soundOn) playOpen();
}

// Touch a silent play once so later notifications can sound without a fresh tap (iOS/Android).
export function unlockAudio() {
  if (unlocked) return;
  ensure();
  [questAudio, alertAudio].forEach((a) => {
    if (!a) return;
    const v = a.volume; a.volume = 0;
    const p = a.play();
    const undo = () => { a.pause(); a.currentTime = 0; a.volume = v; };
    if (p && p.then) p.then(undo).catch(() => { a.volume = v; }); else undo();
  });
}

export function notifyPenalty(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, tag: 'arise-penalty', renotify: true, requireInteraction: true, vibrate: [140, 60, 140], icon: './icon-192.png', badge: './icon-192.png' };
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((r) => r.showNotification(title, opts)).catch(() => { try { new Notification(title, opts); } catch (e) { /* ignore */ } });
  } else {
    try { new Notification(title, opts); } catch (e) { /* ignore */ }
  }
}
