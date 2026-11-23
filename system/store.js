// Data layer: Firebase (online, synced) when config.js has settings, otherwise TEST MODE (this device only).
import { FIREBASE_CONFIG } from "./config.js";

const V = "10.12.2";
const listeners = { policies: new Set(), subbrokers: new Set() };
let api = null;

export const mode = FIREBASE_CONFIG ? "firebase" : "local";

/* ---------- test mode ---------- */
function localApi() {
  const key = c => "bfdesk_" + c;
  const read = c => { try { return JSON.parse(localStorage.getItem(key(c)) || "[]"); } catch (e) { return []; } };
  const write = (c, rows) => { try { localStorage.setItem(key(c), JSON.stringify(rows)); } catch (e) {} emit(c, rows); };
  const emit = (c, rows) => listeners[c].forEach(fn => fn(rows));
  return {
    start(c) { emit(c, read(c)); },
    async add(c, data) { const id = "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); write(c, read(c).concat([{ ...data, id }])); return id; },
    async update(c, id, data) { write(c, read(c).map(r => r.id === id ? { ...r, ...data } : r)); },
    async remove(c, id) { write(c, read(c).filter(r => r.id !== id)); }
  };
}

/* ---------- firebase ---------- */
let fb = null;
async function loadFirebase() {
  const base = `https://www.gstatic.com/firebasejs/${V}/`;
  const [app, auth, fs] = await Promise.all([
    import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-firestore.js")
  ]);
  const a = app.initializeApp(FIREBASE_CONFIG);
  let db;
  try { db = fs.initializeFirestore(a, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }); }
  catch (e) { db = fs.getFirestore(a); }
  fb = { auth: auth.getAuth(a), A: auth, db, F: fs };
  return fb;
}

function firebaseApi() {
  const { db, F } = fb;
  const unsubs = {};
  return {
    start(c, onError) {
      if (unsubs[c]) unsubs[c]();
      unsubs[c] = F.onSnapshot(F.collection(db, c), snap => {
        const rows = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        listeners[c].forEach(fn => fn(rows));
      }, err => onError && onError(err));
    },
    stopAll() { Object.values(unsubs).forEach(u => u()); },
    async add(c, data) { const r = await F.addDoc(F.collection(db, c), data); return r.id; },
    async update(c, id, data) { await F.updateDoc(F.doc(db, c, id), data); },
    async remove(c, id) { await F.deleteDoc(F.doc(db, c, id)); }
  };
}

/* ---------- public ---------- */
// onUser(cb): cb(null) when signed out, cb({email}) when signed in (test mode: always signed in).
export async function init(onUser) {
  if (mode === "local") { api = localApi(); onUser({ email: "test mode" }); return; }
  await loadFirebase();
  api = firebaseApi();
  fb.A.onAuthStateChanged(fb.auth, u => { if (!u) api.stopAll(); onUser(u ? { email: u.email } : null); });
}
export const signIn = (email, pass) => fb.A.signInWithEmailAndPassword(fb.auth, email, pass);
export const resetPassword = email => fb.A.sendPasswordResetEmail(fb.auth, email);
export const signOut = () => fb ? fb.A.signOut(fb.auth) : null;

export function watch(c, fn, onError) { listeners[c].add(fn); api.start(c, onError); }
export const add = (c, data) => api.add(c, data);
export const update = (c, id, data) => api.update(c, id, data);
export const remove = (c, id) => api.remove(c, id);
