// Entitlements: free | trial (active, daysLeft) | trialExpired | pro.
// One 7-day Pro trial per device: the start time is kept in BOTH localStorage and IndexedDB; a record in either = trial used.
// iOS build: map the trial to an App Store subscription introductory offer (StoreKit) – see README. No StoreKit here.
export const TRIAL_MS = 7 * 24 * 3600 * 1000;
export const PRICE = { yearly: '$24.99/yr', lifetime: '$100 one-time' };
const LS_TRIAL = 'lb.trial.start', LS_PRO = 'lb.pro', LS_SEEN = 'lb.trial.endSeen';
const LS_DEV_ENT = 'lb.dev.ent', LS_DEV_CLOCK = 'lb.dev.clockOffset'; // dev/test overrides (localhost only)
export const DEV = typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname);
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
let trialStart = null; const subs = new Set();
export const onChange = (fn) => subs.add(fn);
const emit = () => subs.forEach((fn) => { try { fn(state()); } catch (e) { console.error(e); } });
export const now = () => Date.now() + (DEV ? Number(ls.get(LS_DEV_CLOCK)) || 0 : 0);

// ---- IndexedDB copy of the trial record ----
let idbP = null;
function idb() {
  if (!idbP) idbP = new Promise((res, rej) => { const r = indexedDB.open('levelbook-ent', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return idbP;
}
const idbGet = (k) => idb().then((d) => new Promise((res) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result ?? null); q.onerror = () => res(null); })).catch(() => null);
const idbSet = (k, v) => idb().then((d) => new Promise((res) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); })).catch(() => false);

// Call once at boot: reconciles the two stores (earliest start wins) and applies ?pro=1 / ?free=1 in dev.
export async function init() {
  if (DEV && typeof location !== 'undefined') { const q = new URLSearchParams(location.search); if (q.get('pro') === '1') ls.set(LS_DEV_ENT, 'pro'); if (q.get('free') === '1') try { localStorage.removeItem(LS_DEV_ENT); } catch (e) {} }
  const a = Number(ls.get(LS_TRIAL)) || null; const b = Number(await idbGet('trialStart')) || null;
  trialStart = a && b ? Math.min(a, b) : a || b;
  if (trialStart) { if (a !== trialStart) ls.set(LS_TRIAL, String(trialStart)); if (b !== trialStart) await idbSet('trialStart', trialStart); }
  return state();
}
export function state() {
  if (ls.get(LS_PRO) === '1') return { state: 'pro' };
  if (DEV) { const o = ls.get(LS_DEV_ENT); if (o === 'pro') return { state: 'pro', dev: true }; if (o === 'free') return { state: 'free', dev: true }; }
  if (!trialStart) return { state: 'free' };
  const t = now();
  if (t < trialStart) return { state: 'trialExpired', start: trialStart, rollback: true }; // clock rolled back
  const left = trialStart + TRIAL_MS - t;
  if (left > 0) return { state: 'trial', start: trialStart, ends: trialStart + TRIAL_MS, daysLeft: Math.ceil(left / 86400000), msLeft: left };
  return { state: 'trialExpired', start: trialStart, ends: trialStart + TRIAL_MS };
}
export const isPro = () => { const s = state().state; return s === 'pro' || s === 'trial'; };
export const trialUsed = () => !!trialStart || !!ls.get(LS_TRIAL);
export async function startTrial() {
  if (trialUsed()) return false;
  trialStart = now(); ls.set(LS_TRIAL, String(trialStart)); await idbSet('trialStart', trialStart);
  try { localStorage.removeItem(LS_SEEN); } catch (e) {}
  emit(); return true;
}
// Future purchase hook (StoreKit / web checkout calls this on success).
export function setPro(on) { if (on) ls.set(LS_PRO, '1'); else try { localStorage.removeItem(LS_PRO); } catch (e) {} emit(); }
export const endNoticeSeen = () => ls.get(LS_SEEN) === '1';
export const markEndNoticeSeen = () => ls.set(LS_SEEN, '1');
