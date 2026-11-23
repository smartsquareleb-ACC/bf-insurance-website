import { LINES, lineOf, SUPPLIERS, TRAVEL_DAYS, suggest, summary } from "./catalog.js?v=9";
import * as store from "./store.js?v=9";

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = v => Number(v) || 0;
const money = n => { n = num(n); return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 }); };
const pad = n => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const toUTC = s => { const [y, m, d] = String(s).split("-").map(Number); return Date.UTC(y, (m || 1) - 1, d || 1); };
const daysUntil = s => s ? Math.round((toUTC(s) - toUTC(todayStr())) / 86400000) : null;
const fmtDate = s => { if (!s) return "—"; const [y, m, d] = s.split("-"); return d + "/" + m + "/" + y; };
const addDays = (s, n) => new Date(toUTC(s) + n * 86400000).toISOString().slice(0, 10);
const addYear = s => { if (!s) return ""; const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y + 1, m - 1, d)).toISOString().slice(0, 10); };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const METHODS = ["Cash", "Whish", "OMT", "Other"];

const paid = p => (p.payments || []).reduce((a, x) => a + num(x.amount), 0);
const balance = p => p.supplier === "whish" ? 0 : Math.max(0, num(p.price) - paid(p));  // Whish collects its own payments
const fullName = p => [p.firstName, p.lastName].filter(Boolean).join(" ");
const counts = p => p.supplier !== "whish";                 // Whish Money policies: reminders only, no sales or commission
const subComm = p => p.viaSub ? num(p.subComm) : 0;
const profit = p => counts(p) ? num(p.price) - num(p.cost) - subComm(p) : 0;
const isMotor = p => lineOf(p.line).motor;

function waNumber(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("961")) return d;
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length >= 7 && d.length <= 8) return "961" + d;
  return d;
}
function toast(t) { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => el.hidden = true, 2600); }

/* ---------- state ---------- */
let policies = [], subs = [], loaded = { policies: false, subbrokers: false }, loadError = "", user = null;
let tab = ["overview", "reminders", "policies", "clients", "subbrokers"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview";
let cq = "", monthOffset = 0, q = "", fLine = "", fStatus = "", currentDetail = null, confirmDel = false;
let lang = {}; try { lang = JSON.parse(localStorage.getItem("bf_lang") || "{}") || {}; } catch (e) {}
const subOf = id => subs.find(s => s.id === id);
const byId = id => policies.find(p => p.id === id);

/* ---------- status & reminders ---------- */
function status(p) {
  const n = daysUntil(p.expiry);
  if (p.renewedTo) return { c: "n", t: "Renewed" };
  if (p.closed) return { c: "n", t: p.closed === "endorsement" ? "Endorsement" : "Not renewing" };
  if (n === null) return { c: "n", t: "No expiry" };
  if (n < 0) return { c: "bad", t: "Expired" };
  if (n <= 30) return { c: "warn", t: n === 0 ? "Expires today" : "Expires in " + n + " d" };
  return { c: "ok", t: "Active" };
}
// A renewal stays open (and in the daily alert) from 30 days before expiry until it is renewed or marked "Not renewing". Travel is never renewed.
const openRenewal = p => p.line !== "travel" && !p.renewedTo && !p.closed && !!p.expiry && daysUntil(p.expiry) <= 30;
function reminderStage(p) {
  if (p.renewedTo || p.closed || p.line === "travel") return null;
  const n = daysUntil(p.expiry); if (n === null) return null;
  const r = p.reminders || {};
  if (n >= 0 && n <= 15 && !r.d15) return "d15";
  if (n > 15 && n <= 30 && !r.d30) return "d30";
  return null;
}
const target = p => { if (p.viaSub) { const s = subOf(p.subId); return { name: s ? s.name : "sub-broker", phone: s ? s.phone : "", sub: true }; } return { name: p.firstName || fullName(p), phone: p.phone, sub: false }; };

// Renewal price shown in the reminder: today's portal price when the line has a fixed price, else last price.
function renewPrice(p) {
  const sg = suggest(p.line, p.details || {});
  const v = sg && sg.price ? sg.price : num(p.price);
  return v > 0 ? v : 0;
}
function lineName(p, l) {
  const L = lineOf(p.line), d = p.details || {}, ar = l === "ar";
  if (p.line === "motor_tpl") {
    if (d.cover === "Elzeme only") return ar ? "التأمين الإلزامي" : "compulsory insurance (Elzeme)";
    if (d.cover === "Dod l gheir only") return ar ? "تأمين ضد الغير" : "third-party insurance (Dod l gheir)";
    return ar ? "التأمين الإلزامي وضد الغير" : "Elzeme + Dod l gheir insurance";
  }
  if (p.line === "worker") return (ar ? "تأمين العاملة" : "domestic worker insurance") + (d.workerName ? (ar ? " " : " for ") + d.workerName : "");
  if (p.line === "other" && d.what) return d.what;
  return ar ? L.ar : L.en + " insurance";
}
function message(p, l) {
  const t = target(p), n = daysUntil(p.expiry), ar = l === "ar";
  const plate = isMotor(p) && p.plate ? p.plate : "";
  const price = renewPrice(p), towing = p.line === "motor_tpl" && (p.details || {}).cover !== "Elzeme only";
  const what = lineName(p, l) + (plate ? (ar ? " للسيارة رقم " : " for plate ") + plate : "");
  if (ar) {
    const when = n < 0 ? "خلص بتاريخ " + fmtDate(p.expiry) : n === 0 ? "بيخلص اليوم " + fmtDate(p.expiry) : n === 1 ? "بيخلص بكرا " + fmtDate(p.expiry) : "بيخلص بتاريخ " + fmtDate(p.expiry) + " (بعد " + (n === 2 ? "يومين" : n + " يوم") + ")";
    const priceLine = price ? "💵 سعر التجديد: $" + price + "\n" : "";
    const pay = "💳 الدفع كاش، Whish أو OMT\n";
    if (t.sub) return "مرحبا " + t.name + " 👋\n" +
      "تذكير من BF Insurance 🛡️\n\n" +
      "الزبون " + fullName(p) + ": " + what + " " + when + ".\n" +
      (p.policyNo ? "📄 رقم البوليصة: " + p.policyNo + "\n" : "") + priceLine + "\n" +
      "خبّرنا إذا بدّو يجدّد ومنخلّصها فورًا ✅";
    return "مرحبا " + t.name + " 👋\n" +
      "معك BF Insurance 🛡️\n\n" +
      "حبّينا نذكّرك إنّو " + what + " " + when + ".\n\n" +
      priceLine + pay +
      (towing ? "🚗 ومعك البلاطة إذا صار حادث أو تعطّلت السيارة\n" : "") + "\n" +
      "إذا بتحب نجدّدلك، أكّدلنا لو سمحت 🙏\n\n" +
      "BF Insurance · تأمينك عَ أصولو";
  }
  const when = n < 0 ? "expired on " + fmtDate(p.expiry) : n === 0 ? "expires today, " + fmtDate(p.expiry) : n === 1 ? "expires tomorrow, " + fmtDate(p.expiry) : "expires on " + fmtDate(p.expiry) + " (in " + n + " days)";
  const priceLine = price ? "💵 Renewal price: $" + price + "\n" : "";
  if (t.sub) return "Hello " + t.name + " 👋\n" +
    "A reminder from BF Insurance 🛡️\n\n" +
    "Your client " + fullName(p) + ": " + what + " " + when + ".\n" +
    (p.policyNo ? "📄 Policy no: " + p.policyNo + "\n" : "") + priceLine + "\n" +
    "Let us know if they'd like to renew and we'll handle it right away ✅";
  return "Hello " + t.name + " 👋\n" +
    "This is BF Insurance 🛡️\n\n" +
    "Your " + what + " " + when + ".\n\n" +
    priceLine + "💳 Pay by cash, Whish or OMT\n" +
    (towing ? "🚗 Towing included for accidents and breakdowns\n" : "") + "\n" +
    "If you'd like us to renew it, please confirm 🙏\n\n" +
    "BF Insurance · Protection, done properly";
}

/* ---------- shell ---------- */
function shell() {
  $("#app").innerHTML =
    '<header><div class="wrap"><div class="bar">' +
    '<img class="mark" src="logo.svg" alt="">' +
    '<div class="brand"><h1>BF Insurance</h1><p>Policy desk</p></div><div class="spacer"></div>' +
    '<button class="btn primary" id="newBtn" type="button">+ New policy</button>' + (store.mode === "firebase" ? '<button class="btn ghost small" id="outBtn" type="button">Sign out</button>' : '') + '</div>' +
    '<nav id="tabs">' +
    '<button type="button" data-tab="overview">Overview</button>' +
    '<button type="button" data-tab="reminders">Reminders <span class="count" id="remCount" hidden></span></button>' +
    '<button type="button" data-tab="policies">Policies</button>' +
    '<button type="button" data-tab="clients">Clients</button>' +
    '<button type="button" data-tab="subbrokers">Sub-brokers</button>' +
    '</nav></div></header><main class="wrap" id="view"></main>';
  document.querySelectorAll("#tabs button").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
  $("#newBtn").addEventListener("click", () => openForm(null));
  const ob = $("#outBtn"); if (ob) ob.addEventListener("click", () => store.signOut());
}
function setTab(t) { tab = t; try { history.replaceState(null, "", "#" + t); } catch (e) {} render(); window.scrollTo(0, 0); }

function render() {
  if (!$("#view")) return;
  document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-current", String(b.dataset.tab === tab)));
  const due = policies.filter(openRenewal).length, rc = $("#remCount");
  rc.hidden = !due; rc.textContent = due;
  const v = $("#view");
  const banner = store.mode === "local" ? '<div class="notice">Test mode: data is saved on this device only. It moves online once Firebase is connected.</div>' : "";
  if (!loaded.policies) { v.innerHTML = banner + (loadError ? '<div class="notice">' + esc(loadError) + '</div>' : '<p class="sub">Loading your policies…</p>'); return; }
  const ae = document.activeElement;
  if (ae && (ae.id === "q" || ae.id === "cq") && v.contains(ae) && (tab === "policies" || tab === "clients")) { refreshResults(); return; }
  v.innerHTML = banner + (tab === "overview" ? overview() : tab === "reminders" ? reminders() : tab === "subbrokers" ? subView() : tab === "clients" ? clientsView() : policyList());
  bindView();
}

function rowHTML(p) {
  const L = lineOf(p.line), s = status(p), b = balance(p), sub = p.viaSub ? subOf(p.subId) : null;
  return '<div class="row" tabindex="0" data-open="' + esc(p.id) + '">' +
    '<div class="who"><b>' + esc(fullName(p) || "Unnamed client") + '</b><small>' + (sub ? "via " + esc(sub.name) : esc(p.phone || "")) + '</small></div>' +
    '<div class="meta"><span class="line">' + esc(L.en) + (isMotor(p) && p.plate ? ' <span class="plate">' + esc(p.plate) + '</span>' : '') + (p.supplier === "whish" ? ' <span class="tag">Whish</span>' : '') + '</span><small>' + esc(summary(p)) + '</small></div>' +
    '<div class="meta hide-sm"><small>Expires ' + esc(fmtDate(p.expiry)) + '</small>' + (b > 0 ? '<br><small style="color:var(--bad)">Owes ' + money(b) + '</small>' : '') + '</div>' +
    '<div><span class="pill ' + s.c + '">' + esc(s.t) + '</span></div></div>';
}

/* ---------- overview (monthly) ---------- */
function monthKey(off) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + off); return { y: d.getFullYear(), m: d.getMonth(), key: d.getFullYear() + "-" + pad(d.getMonth() + 1) }; }
function overview() {
  const M = monthKey(monthOffset), today = todayStr();
  const inMonth = policies.filter(p => (p.inception || "").startsWith(M.key));
  const sold = inMonth.filter(counts);
  const sales = sold.reduce((a, p) => a + num(p.price), 0);
  const prof = sold.reduce((a, p) => a + profit(p), 0);
  const subPay = sold.reduce((a, p) => a + subComm(p), 0);
  const whish = inMonth.length - sold.length;
  const owed = policies.reduce((a, p) => a + balance(p), 0), owers = policies.filter(p => balance(p) > 0);
  const active = policies.filter(p => p.expiry && p.expiry >= today && !p.renewedTo).length;
  const expMonth = policies.filter(p => (p.expiry || "").startsWith(M.key) && !p.renewedTo).length;
  const due = policies.filter(reminderStage).sort((a, b) => a.expiry.localeCompare(b.expiry));
  let h = '<div class="month"><button class="btn small" type="button" id="mPrev" aria-label="Previous month">‹</button><b>' + MONTHS[M.m] + ' ' + M.y + '</b><button class="btn small" type="button" id="mNext" aria-label="Next month"' + (monthOffset >= 0 ? ' disabled' : '') + '>›</button>' + (monthOffset ? '<button class="btn small ghost" type="button" id="mNow">This month</button>' : '') + '</div>';
  h += '<div class="kpis">' +
    '<div class="kpi main"><span>Sales</span><b>' + money(sales) + '</b><small>' + sold.length + ' policies' + (whish ? ' · ' + whish + ' Whish not counted' : '') + '</small></div>' +
    '<div class="kpi"><span>My profit</span><b style="color:var(--ok)">' + money(prof) + '</b><small>' + (subPay ? 'after ' + money(subPay) + ' to sub-brokers' : 'price minus cost') + '</small></div>' +
    '<div class="kpi"><span>Expiring this month</span><b>' + expMonth + '</b><small>' + active + ' active policies</small></div>' +
    '<div class="kpi"><span>Still to collect</span><b style="color:' + (owed > 0 ? 'var(--bad)' : 'inherit') + '">' + money(owed) + '</b><small>' + owers.length + ' clients, all months</small></div></div>';
  h += '<h3>Reminders to send</h3><div class="list">' + (due.length ? due.slice(0, 5).map(rowHTML).join("") : '<div class="empty">No reminders due. Policies show up here 30 days and 15 days before they expire.</div>') + '</div>';
  if (due.length > 5) h += '<p><button class="btn small" data-go="reminders" type="button">See all ' + due.length + ' reminders</button></p>';
  if (owers.length) h += '<h3>Clients who still owe</h3><div class="list">' + owers.sort((a, b) => balance(b) - balance(a)).slice(0, 6).map(rowHTML).join("") + '</div>';
  h += '<h3>Policies made in ' + MONTHS[M.m] + '</h3><div class="list">' + (inMonth.length ? inMonth.sort((a, b) => b.inception.localeCompare(a.inception)).map(rowHTML).join("") : '<div class="empty">No policies this month yet. Tap <b>+ New policy</b> to add one.</div>') + '</div>';
  return h;
}

/* ---------- reminders ---------- */
function reminders() {
  const list = policies.filter(reminderStage).sort((a, b) => a.expiry.localeCompare(b.expiry));
  const expired = policies.filter(p => openRenewal(p) && daysUntil(p.expiry) < 0).sort((a, b) => b.expiry.localeCompare(a.expiry));
  const waiting = policies.filter(p => openRenewal(p) && !reminderStage(p) && daysUntil(p.expiry) >= 0).sort((a, b) => a.expiry.localeCompare(b.expiry));
  let h = '<h2>Reminders</h2><p class="sub">Each policy comes up 30 days and 15 days before it expires. Sub-broker policies go to the sub-broker. Tap WhatsApp, check the message, and press send. A policy stays here until you renew it or mark it <b>Not renewing</b>.</p>';
  h += '<div class="list">' + (list.length ? list.map(remHTML).join("") : '<div class="empty">Nothing to send right now.</div>') + '</div>';
  if (waiting.length) h += '<h3>Reminded, waiting for an answer</h3><div class="list">' + waiting.map(rowHTML).join("") + '</div>';
  if (expired.length) h += '<h3>Expired, not renewed yet</h3><div class="list">' + expired.map(rowHTML).join("") + '</div>';
  return h;
}
function remHTML(p) {
  const st = reminderStage(p), l = lang[p.id] || "ar", L = lineOf(p.line), t = target(p), wn = waNumber(t.phone), msg = message(p, l);
  const href = "https://wa.me/" + encodeURIComponent(wn) + "?text=" + encodeURIComponent(msg);
  return '<div class="rem"><div><b>' + esc(fullName(p)) + '</b> <span class="pill ' + (st === "d15" ? "bad" : "warn") + '">' + (st === "d15" ? "15-day reminder" : "30-day reminder") + '</span>' + (t.sub ? ' <span class="pill b">to ' + esc(t.name) + '</span>' : '') + '<br>' +
    '<small style="color:var(--muted)">' + esc(L.en) + (isMotor(p) && p.plate ? ' · ' + esc(p.plate) : '') + ' · expires ' + esc(fmtDate(p.expiry)) + ' (' + daysUntil(p.expiry) + ' days) · ' + esc(t.phone || "no phone") + '</small></div>' +
    '<div class="acts"><span class="seg" role="group" aria-label="Message language"><button type="button" data-lang="ar" data-id="' + esc(p.id) + '" aria-pressed="' + (l === "ar") + '">عربي</button><button type="button" data-lang="en" data-id="' + esc(p.id) + '" aria-pressed="' + (l === "en") + '">English</button></span>' +
    (wn ? '<a class="btn wa small" href="' + esc(href) + '" target="_blank" rel="noopener" data-wa="' + esc(p.id) + '" data-stage="' + st + '">WhatsApp</a>' : '<span class="pill bad">Add a phone number</span>') +
    '<button class="btn small" type="button" data-copy="' + esc(p.id) + '">Copy</button>' +
    '<button class="btn small" type="button" data-sent="' + esc(p.id) + '" data-stage="' + st + '">Mark sent</button>' +
    '<button class="btn small" type="button" data-close-pol="' + esc(p.id) + '">Not renewing</button></div>' +
    '<div class="msg" dir="' + (l === "ar" ? "rtl" : "ltr") + '">' + esc(msg) + '</div></div>';
}
// Reminder buttons on the policy screen: shown from 30 days before expiry, or any time on request.
function remBox(p) {
  if (p.renewedTo || p.closed || p.line === "travel") return "";
  const n = daysUntil(p.expiry); if (n === null || n < -60) return "";
  const t = target(p), wn = waNumber(t.phone), st = reminderStage(p) || "";
  if (!wn) return '<div class="rembox"><h3 style="margin-top:4px">Renewal reminder</h3><p class="sub">Add a phone number (Edit) to send the WhatsApp reminder.</p></div>';
  const link = l => "https://wa.me/" + encodeURIComponent(wn) + "?text=" + encodeURIComponent(message(p, l));
  return '<div class="rembox"><h3 style="margin-top:4px">Renewal reminder</h3>' +
    '<p class="sub">Opens WhatsApp with the message ready' + (t.sub ? ' for ' + esc(t.name) : '') + '. Check it and press send.</p>' +
    '<div class="acts"><a class="btn wa small" href="' + esc(link("ar")) + '" target="_blank" rel="noopener" data-wa="' + esc(p.id) + '" data-stage="' + st + '">WhatsApp عربي</a>' +
    '<a class="btn wa small" href="' + esc(link("en")) + '" target="_blank" rel="noopener" data-wa="' + esc(p.id) + '" data-stage="' + st + '">WhatsApp English</a></div></div>';
}
async function setClosed(id, on) {
  try { await store.update("policies", id, on ? { closed: "not_renewing", closedAt: todayStr() } : { closed: null, closedAt: null }); toast(on ? "Marked not renewing. No more alerts for it." : "Back on the renewal list"); }
  catch (e) { toast("Could not save. Check your connection and try again."); }
}
async function markSent(id, stage, viaWa) {
  const p = byId(id); if (!p || !stage) return;
  const r = Object.assign({}, p.reminders || {}); r[stage] = todayStr(); if (stage === "d15" && !r.d30) r.d30 = r.d15;
  try { await store.update("policies", id, { reminders: r }); toast(viaWa ? "Marked as sent. Press send in WhatsApp." : "Marked as sent"); }
  catch (e) { toast("Could not save. Check your connection and try again."); }
}

/* ---------- policies list ---------- */
function policyList() {
  const needle = q.trim().toLowerCase();
  const list = policies.filter(p => {
    if (fLine && p.line !== fLine) return false;
    if (fStatus) {
      const s = status(p).t;
      if (fStatus === "active" && s !== "Active") return false;
      if (fStatus === "soon" && !s.startsWith("Expires")) return false;
      if (fStatus === "expired" && s !== "Expired") return false;
      if (fStatus === "owes" && !(balance(p) > 0)) return false;
      if (fStatus === "whish" && p.supplier !== "whish") return false;
      if (fStatus === "sub" && !p.viaSub) return false;
    }
    if (!needle) return true;
    const sub = p.viaSub ? subOf(p.subId) : null;
    return [fullName(p), p.phone, p.policyNo, p.plate, sub && sub.name].some(x => String(x || "").toLowerCase().includes(needle));
  }).sort((a, b) => (a.expiry || "").localeCompare(b.expiry || ""));
  const opt = (v, t, cur) => '<option value="' + v + '"' + (cur === v ? " selected" : "") + '>' + esc(t) + '</option>';
  let h = '<div class="headrow"><div><h2>Policies</h2><p class="sub">' + list.length + ' of ' + policies.length + ' · sorted by expiry date</p></div><button class="btn small" type="button" id="exportBtn">Export to Excel</button></div>';
  h += '<div class="tools"><input id="q" type="search" placeholder="Search name, phone, policy no., plate, sub-broker" value="' + esc(q) + '">' +
    '<select id="fLine"><option value="">All insurance types</option>' + LINES.map(l => opt(l.k, l.en, fLine)).join("") + '</select>' +
    '<select id="fStatus">' + opt("", "Any status", fStatus) + opt("active", "Active", fStatus) + opt("soon", "Expiring within 30 days", fStatus) + opt("expired", "Expired", fStatus) + opt("owes", "Still owes money", fStatus) + opt("sub", "Sub-broker policies", fStatus) + opt("whish", "Whish Money policies", fStatus) + '</select></div>';
  h += '<div class="list">' + (list.length ? list.map(rowHTML).join("") : '<div class="empty">' + (policies.length ? "No policy matches this search." : "No policies yet. Tap <b>+ New policy</b> to add your first client.") + '</div>') + '</div>';
  return h;
}

/* ---------- sub-brokers ---------- */
function subView() {
  const M = monthKey(0);
  let h = '<div class="headrow"><div><h2>Sub-brokers</h2><p class="sub">Their policies are saved under their name, and renewal reminders go to them.</p></div><button class="btn primary small" type="button" id="addSub">+ Add sub-broker</button></div>';
  h += '<div class="list">' + (subs.length ? subs.slice().sort((a, b) => a.name.localeCompare(b.name)).map(s => {
    const mine = policies.filter(p => p.viaSub && p.subId === s.id);
    const mm = mine.filter(p => (p.inception || "").startsWith(M.key));
    return '<div class="row" tabindex="0" data-sub="' + esc(s.id) + '"><div class="who"><b>' + esc(s.name) + '</b><small>' + esc(s.phone || "") + '</small></div>' +
      '<div class="meta"><span class="line">' + mine.length + ' policies</span><small>' + MONTHS[M.m] + ': ' + mm.length + ' sold, ' + money(mm.reduce((a, p) => a + subComm(p), 0)) + ' commission to him, ' + money(mm.reduce((a, p) => a + profit(p), 0)) + ' to me</small></div>' +
      '<div class="hide-sm"></div><div><span class="btn small">Edit</span></div></div>';
  }).join("") : '<div class="empty">No sub-brokers yet. Tap <b>+ Add sub-broker</b>.</div>') + '</div>';
  return h;
}
function openSubForm(s, onSaved) {
  const isEdit = !!(s && s.id);
  $("#modal").innerHTML = '<div class="overlay" id="ov"><div class="sheet" role="dialog" aria-modal="true" aria-label="Sub-broker"><div class="sheet-head"><h2>' + (isEdit ? "Edit sub-broker" : "New sub-broker") + '</h2><button class="x" type="button" data-close aria-label="Close">×</button></div>' +
    '<form id="sf"><div class="grid"><label>Name<input id="s_name" required value="' + esc(s && s.name) + '"></label><label>Phone (WhatsApp)<input id="s_phone" type="tel" inputmode="tel" value="' + esc(s && s.phone) + '"></label></div>' +
    '<div class="actions">' + (isEdit ? '<button class="btn danger" type="button" id="s_del">Delete</button>' : '') + '<button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div></form></div></div>';
  bindModalClose();
  $("#sf").addEventListener("submit", async e => {
    e.preventDefault();
    const data = { name: $("#s_name").value.trim(), phone: $("#s_phone").value.trim() };
    try {
      let id = s && s.id;
      if (isEdit) await store.update("subbrokers", id, data); else id = await store.add("subbrokers", data);
      toast("Sub-broker saved"); if (onSaved) onSaved(id); else closeModal();
    } catch (err) { toast("Could not save. Try again."); }
  });
  if (isEdit) $("#s_del").addEventListener("click", async () => {
    if (policies.some(p => p.viaSub && p.subId === s.id)) { toast("This sub-broker has policies. Move them first."); return; }
    try { await store.remove("subbrokers", s.id); closeModal(); toast("Sub-broker deleted"); } catch (err) { toast("Could not delete. Try again."); }
  });
}

/* ---------- clients ---------- */
const clientKey = p => fullName(p).toLowerCase().replace(/\s+/g, " ").trim();
function clientGroups() {
  const m = new Map();
  for (const p of policies) { const k = clientKey(p) || "(no name)"; if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
  return [...m.entries()].map(([k, ps]) => {
    const today = todayStr();
    const next = ps.filter(p => !p.renewedTo && p.expiry && p.expiry >= today).map(p => p.expiry).sort()[0] || "";
    return { k, ps, name: fullName(ps[0]) || "Unnamed client", phone: (ps.find(p => p.phone) || {}).phone || "", next, owes: ps.reduce((a, p) => a + balance(p), 0) };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
function clientsView() {
  const needle = cq.trim().toLowerCase(), all = clientGroups();
  const list = all.filter(c => !needle || [c.name, c.phone].concat(c.ps.map(p => p.plate), c.ps.map(p => p.policyNo)).some(x => String(x || "").toLowerCase().includes(needle)));
  const noPhone = all.filter(c => !c.phone).length;
  let h = '<div class="headrow"><div><h2>Clients</h2><p class="sub">' + list.length + ' of ' + all.length + ' clients' + (noPhone ? ' · ' + noPhone + ' without a phone number' : '') + '</p></div></div>';
  h += '<div class="tools"><input id="cq" type="search" placeholder="Search name, phone, plate, policy no." value="' + esc(cq) + '"></div>';
  h += '<div class="list">' + (list.length ? list.map(c => '<div class="row" tabindex="0" data-client="' + esc(c.k) + '">' +
    '<div class="who"><b>' + esc(c.name) + '</b><small>' + (c.phone ? esc(c.phone) : '<span style="color:var(--bad)">No phone</span>') + '</small></div>' +
    '<div class="meta"><span class="line">' + c.ps.length + (c.ps.length === 1 ? ' policy' : ' policies') + '</span><small>' + esc([...new Set(c.ps.map(p => lineOf(p.line).en))].join(" · ")) + '</small></div>' +
    '<div class="meta hide-sm"><small>' + (c.next ? 'Next expiry ' + esc(fmtDate(c.next)) : 'No active policy') + '</small>' + (c.owes > 0 ? '<br><small style="color:var(--bad)">Owes ' + money(c.owes) + '</small>' : '') + '</div>' +
    '<div><span class="pill ' + (c.next ? "ok" : "n") + '">' + (c.next ? "Active" : "Inactive") + '</span></div></div>').join("") : '<div class="empty">No client matches this search.</div>') + '</div>';
  return h;
}
function openClient(k) {
  const c = clientGroups().find(x => x.k === k); if (!c) return;
  const f = c.ps[0], wn = waNumber(c.phone);
  $("#modal").innerHTML = '<div class="overlay" id="ov"><div class="sheet" role="dialog" aria-modal="true" aria-label="Client"><div class="sheet-head"><div><h2>' + esc(c.name) + '</h2><span class="pill n">' + c.ps.length + (c.ps.length === 1 ? ' policy' : ' policies') + '</span></div><button class="x" type="button" data-close aria-label="Close">×</button></div>' +
    '<form id="cf"><div class="grid"><label>First name<input id="c_first" value="' + esc(f.firstName) + '"></label><label>Family name<input id="c_last" value="' + esc(f.lastName) + '"></label>' +
    '<label class="full">Phone (WhatsApp)<span class="phonerow"><input id="c_phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="03 123 456" value="' + esc(c.phone) + '">' +
    ('contacts' in navigator && 'select' in navigator.contacts ? '<button class="btn small" type="button" id="c_pick">Contacts</button>' : '') +
    (navigator.clipboard && navigator.clipboard.readText ? '<button class="btn small" type="button" id="c_paste">Paste</button>' : '') + '</span></label></div>' +
    '<p class="sub">Saving updates the name and phone on all ' + c.ps.length + ' of this client\'s policies.</p>' +
    '<div class="actions">' + (wn ? '<a class="btn wa" href="https://wa.me/' + esc(wn) + '" target="_blank" rel="noopener">WhatsApp chat</a>' : '') + '<button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>' +
    '<h3>Policies</h3><div class="list">' + c.ps.slice().sort((a, b) => (b.expiry || "").localeCompare(a.expiry || "")).map(rowHTML).join("") + '</div></div></div>';
  bindModalClose();
  $("#modal").querySelectorAll("[data-open]").forEach(el => el.addEventListener("click", () => openDetail(el.dataset.open)));
  const clean = t => { const m = String(t || "").match(/\+?[\d][\d\s\-().]{5,}\d/); return m ? m[0].replace(/[\s\-().]/g, "") : ""; };
  if ($("#c_pick")) $("#c_pick").addEventListener("click", async () => { try { const [x] = await navigator.contacts.select(["tel"], { multiple: false }); const t = x && clean((x.tel || [])[0]); if (t) $("#c_phone").value = t; } catch (e) { toast("Could not open contacts"); } });
  if ($("#c_paste")) $("#c_paste").addEventListener("click", async () => { try { const t = clean(await navigator.clipboard.readText()); if (t) $("#c_phone").value = t; else toast("No phone number copied"); } catch (e) { toast("Allow paste, or long-press the box and choose Paste"); } });
  $("#cf").addEventListener("submit", async e => {
    e.preventDefault();
    const data = { firstName: $("#c_first").value.trim(), lastName: $("#c_last").value.trim(), phone: $("#c_phone").value.trim() };
    try { await Promise.all(c.ps.map(p => store.update("policies", p.id, data))); closeModal(); toast("Client saved"); }
    catch (err) { toast("Could not save. Check your connection and try again."); }
  });
}

/* Search: update only the results list, never the box being typed in (full re-render made typing lag on iPhone). */
let searchTimer = null;
function searchSoon() { clearTimeout(searchTimer); searchTimer = setTimeout(refreshResults, 180); }
function refreshResults() {
  const v = $("#view"); if (!v) return;
  const t = document.createElement("div");
  t.innerHTML = tab === "clients" ? clientsView() : policyList();
  const nl = t.querySelector(".list"), ol = v.querySelector(".list"), ns = t.querySelector(".headrow .sub"), os = v.querySelector(".headrow .sub");
  if (!nl || !ol) return;
  ol.replaceWith(nl); if (ns && os) os.innerHTML = ns.innerHTML;
  bindRows(nl);
}
function bindRows(root) {
  root.querySelectorAll("[data-open]").forEach(el => { el.addEventListener("click", () => openDetail(el.dataset.open)); el.addEventListener("keydown", e => { if (e.key === "Enter") openDetail(el.dataset.open); }); });
  root.querySelectorAll("[data-client]").forEach(el => { el.addEventListener("click", () => openClient(el.dataset.client)); el.addEventListener("keydown", e => { if (e.key === "Enter") openClient(el.dataset.client); }); });
}

function bindView() {
  const v = $("#view");
  v.querySelectorAll("[data-open]").forEach(el => { el.addEventListener("click", () => openDetail(el.dataset.open)); el.addEventListener("keydown", e => { if (e.key === "Enter") openDetail(el.dataset.open); }); });
  v.querySelectorAll("[data-sub]").forEach(el => el.addEventListener("click", () => openSubForm(subOf(el.dataset.sub))));
  v.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => setTab(b.dataset.go)));
  v.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => { lang[b.dataset.id] = b.dataset.lang; try { localStorage.setItem("bf_lang", JSON.stringify(lang)); } catch (e) {} render(); }));
  v.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", () => { const p = byId(b.dataset.copy); navigator.clipboard.writeText(message(p, lang[p.id] || "ar")).then(() => toast("Message copied"), () => toast("Copy blocked. Select the message text instead.")); }));
  v.querySelectorAll("[data-wa]").forEach(a => a.addEventListener("click", () => markSent(a.dataset.wa, a.dataset.stage, true)));
  v.querySelectorAll("[data-sent]").forEach(b => b.addEventListener("click", () => markSent(b.dataset.sent, b.dataset.stage, false)));
  v.querySelectorAll("[data-close-pol]").forEach(b => b.addEventListener("click", () => setClosed(b.dataset.closePol, true)));
  const qi = $("#q"); if (qi) qi.addEventListener("input", () => { q = qi.value; searchSoon(); });
  v.querySelectorAll("[data-client]").forEach(el => { el.addEventListener("click", () => openClient(el.dataset.client)); el.addEventListener("keydown", e => { if (e.key === "Enter") openClient(el.dataset.client); }); });
  const ci = $("#cq"); if (ci) ci.addEventListener("input", () => { cq = ci.value; searchSoon(); });
  const fl = $("#fLine"); if (fl) fl.addEventListener("change", () => { fLine = fl.value; render(); });
  const fs = $("#fStatus"); if (fs) fs.addEventListener("change", () => { fStatus = fs.value; render(); });
  const ex = $("#exportBtn"); if (ex) ex.addEventListener("click", exportCSV);
  const as = $("#addSub"); if (as) as.addEventListener("click", () => openSubForm(null));
  const mp = $("#mPrev"); if (mp) mp.addEventListener("click", () => { monthOffset--; render(); });
  const mn = $("#mNext"); if (mn) mn.addEventListener("click", () => { if (monthOffset < 0) { monthOffset++; render(); } });
  const mw = $("#mNow"); if (mw) mw.addEventListener("click", () => { monthOffset = 0; render(); });
}

/* ---------- detail ---------- */
function openDetail(id) { confirmDel = false; drawDetail(id); }
function drawDetail(id) {
  const p = byId(id); if (!p) { closeModal(); return; }
  currentDetail = id;
  const L = lineOf(p.line), s = status(p), pd = paid(p), b = balance(p), r = p.reminders || {}, sub = p.viaSub ? subOf(p.subId) : null;
  const sup = SUPPLIERS.find(x => x.k === p.supplier) || SUPPLIERS[0];
  const pays = (p.payments || []).slice().sort((a, c) => String(a.date).localeCompare(String(c.date)));
  const dd = (t, v) => '<div><dt>' + t + '</dt><dd>' + v + '</dd></div>';
  let h = '<div class="overlay" id="ov"><div class="sheet" role="dialog" aria-modal="true" aria-label="Policy details">' +
    '<div class="sheet-head"><div><h2>' + esc(fullName(p)) + '</h2><span class="pill ' + s.c + '">' + esc(s.t) + '</span>' + (sub ? ' <span class="pill b">via ' + esc(sub.name) + '</span>' : '') + (p.supplier === "whish" ? ' <span class="pill n">Whish Money, not in sales</span>' : '') + '</div><button class="x" type="button" data-close aria-label="Close">×</button></div>' +
    '<dl>' + dd("Phone", esc(p.phone || "—")) + dd("Insurance", esc(L.en)) +
    '<div style="grid-column:1/-1"><dt>Options</dt><dd>' + esc(summary(p) || "—") + '</dd></div>' +
    dd("Policy number", esc(p.policyNo || "—")) + (L.motor ? dd("Car plate", p.plate ? '<span class="plate">' + esc(p.plate) + '</span>' : "—") : '') +
    dd("Supplier", esc(p.supplier === "other" ? (p.supplierOther || "Other") : sup.en)) +
    dd("Inception", esc(fmtDate(p.inception))) + dd("Expiry", esc(fmtDate(p.expiry))) +
    dd("Price / cost", money(p.price) + " / " + money(p.cost)) +
    (p.viaSub ? dd("Sub-broker commission", money(p.subComm)) : '') +
    dd("My profit", counts(p) ? '<span style="color:var(--ok)">' + money(profit(p)) + '</span>' : "Not counted (Whish)") +
    dd("Reminders", "30 days: " + (r.d30 ? esc(fmtDate(r.d30)) : "not sent") + "<br>15 days: " + (r.d15 ? esc(fmtDate(r.d15)) : "not sent")) +
    (p.notes ? '<div style="grid-column:1/-1"><dt>Notes</dt><dd style="white-space:pre-wrap;font-weight:400">' + esc(p.notes) + '</dd></div>' : '') + '</dl>' +
    '<div class="bal"><div><span>Price</span><b>' + money(p.price) + '</b></div><div><span>Paid</span><b style="color:var(--ok)">' + money(pd) + '</b></div><div><span>Remaining</span><b style="color:' + (b > 0 ? 'var(--bad)' : 'inherit') + '">' + money(b) + '</b></div></div>' +
    remBox(p) +
    '<h3 style="margin-top:4px">Payments</h3>' +
    (pays.length ? pays.map((x, i) => '<div class="pay"><span>' + esc(fmtDate(x.date)) + ' · ' + esc(x.method || "") + '</span><span style="display:flex;gap:10px;align-items:center"><b>' + money(x.amount) + '</b><button class="btn small danger" type="button" data-delpay="' + esc(x.id || String(i)) + '">Remove</button></span></div>').join("") : '<p class="sub">No payments yet.</p>') +
    '<form class="payform" id="payForm"><label>Amount ($)<input id="payAmt" type="number" min="0" step="0.01" inputmode="decimal" value="' + (b > 0 ? b : "") + '" required></label>' +
    '<label>Date<input id="payDate" type="date" value="' + todayStr() + '" required></label>' +
    '<label>Method<select id="payMethod">' + METHODS.map(m => '<option>' + m + '</option>').join("") + '</select></label>' +
    '<button class="btn primary" type="submit">Add payment</button></form>' +
    '<div class="actions"><button class="btn danger" type="button" id="delBtn">Delete</button>' + (p.closed ? '<button class="btn" type="button" id="reopenBtn">Undo not renewing</button>' : !p.renewedTo && p.line !== "travel" ? '<button class="btn" type="button" id="notRenBtn">Not renewing</button>' : '') + '<button class="btn" type="button" id="renewBtn">Renew</button><button class="btn primary" type="button" id="editBtn">Edit</button></div>' +
    (confirmDel ? '<div class="confirm">Delete this policy and its payments for good?<button class="btn small danger" type="button" id="delYes">Yes, delete</button><button class="btn small" type="button" id="delNo">Keep it</button></div>' : '') +
    '</div></div>';
  $("#modal").innerHTML = h; bindModalClose();
  $("#payForm").addEventListener("submit", async e => {
    e.preventDefault();
    const amt = num($("#payAmt").value); if (!(amt > 0)) { toast("Enter an amount above 0"); return; }
    const list = (p.payments || []).concat([{ id: "p" + Date.now(), amount: amt, date: $("#payDate").value || todayStr(), method: $("#payMethod").value }]);
    try { await store.update("policies", p.id, { payments: list }); toast("Payment added"); } catch (err) { toast("Could not save the payment. Try again."); }
  });
  $("#modal").querySelectorAll("[data-delpay]").forEach(btn => btn.addEventListener("click", async () => {
    const list = (p.payments || []).filter((x, i) => (x.id || String(i)) !== btn.dataset.delpay);
    try { await store.update("policies", p.id, { payments: list }); toast("Payment removed"); } catch (err) { toast("Could not remove it. Try again."); }
  }));
  $("#modal").querySelectorAll("[data-wa]").forEach(a => a.addEventListener("click", () => { if (a.dataset.stage) markSent(a.dataset.wa, a.dataset.stage, true); }));
  $("#editBtn").addEventListener("click", () => openForm(p));
  if ($("#notRenBtn")) $("#notRenBtn").addEventListener("click", () => setClosed(p.id, true));
  if ($("#reopenBtn")) $("#reopenBtn").addEventListener("click", () => setClosed(p.id, false));
  $("#renewBtn").addEventListener("click", () => {
    const start = p.expiry || todayStr();
    const { id, payments, reminders, renewedTo, renewedFrom, createdAt, policyNo, closed, closedAt, ...rest } = p;
    openForm({ ...rest, inception: start, expiry: addYear(start), _renewFrom: p.id });
  });
  $("#delBtn").addEventListener("click", () => { confirmDel = true; drawDetail(p.id); });
  if (confirmDel) {
    $("#delNo").addEventListener("click", () => { confirmDel = false; drawDetail(p.id); });
    $("#delYes").addEventListener("click", async () => { try { await store.remove("policies", p.id); closeModal(); toast("Policy deleted"); } catch (err) { toast("Could not delete. Try again."); } });
  }
}

/* ---------- new / edit form ---------- */
function fieldHTML(f, d) {
  const v = d[f.id], id = "d_" + f.id;
  if (f.type === "check") return '<label class="chk" data-f="' + f.id + '"><input type="checkbox" id="' + id + '"' + (v ? " checked" : "") + '>' + esc(f.label) + '</label>';
  if (f.type === "number") return '<label data-f="' + f.id + '">' + esc(f.label) + '<input id="' + id + '" type="number" min="0" inputmode="decimal" value="' + esc(v) + '"></label>';
  if (f.type === "text") return '<label data-f="' + f.id + '">' + esc(f.label) + '<input id="' + id + '" value="' + esc(v) + '" autocomplete="off"></label>';
  const cur = v || f.opts[0];
  return '<label data-f="' + f.id + '">' + esc(f.label) + '<select id="' + id + '">' + f.opts.map(o => '<option' + (o === cur ? " selected" : "") + '>' + esc(o) + '</option>').join("") + '</select></label>';
}
function readDetails(L) {
  const d = {};
  for (const f of L.fields) { const el = $("#d_" + f.id); if (!el) continue; d[f.id] = f.type === "check" ? el.checked : f.type === "number" ? (el.value === "" ? "" : num(el.value)) : el.value; }
  return d;
}

function openForm(p) {
  const isEdit = !!(p && p.id);
  const d0 = p || { line: "motor_tpl", supplier: "securite", inception: todayStr(), expiry: addYear(todayStr()), details: {} };
  const groups = [...new Set(LINES.map(l => l.group))];
  const lineSel = groups.map(g => '<optgroup label="' + g + '">' + LINES.filter(l => l.group === g).map(l => '<option value="' + l.k + '"' + (d0.line === l.k ? " selected" : "") + '>' + esc(l.en) + '</option>').join("") + '</optgroup>').join("");
  const subOpts = '<option value="">Choose…</option>' + subs.slice().sort((a, b) => a.name.localeCompare(b.name)).map(s => '<option value="' + esc(s.id) + '"' + (d0.subId === s.id ? " selected" : "") + '>' + esc(s.name) + '</option>').join("") + '<option value="__new">+ Add a new sub-broker</option>';
  $("#modal").innerHTML = '<div class="overlay" id="ov"><div class="sheet" role="dialog" aria-modal="true" aria-label="Policy form">' +
    '<div class="sheet-head"><h2>' + (isEdit ? "Edit policy" : d0._renewFrom ? "Renew policy" : "New policy") + '</h2><button class="x" type="button" data-close aria-label="Close">×</button></div><form id="pf">' +
    '<fieldset><legend>Who sold it</legend><div class="grid">' +
      '<label>Supplier<select id="f_sup">' + SUPPLIERS.map(s => '<option value="' + s.k + '"' + (d0.supplier === s.k ? " selected" : "") + '>' + esc(s.en) + '</option>').join("") + '</select></label>' +
      '<label id="supOtherWrap">Supplier name<input id="f_supOther" value="' + esc(d0.supplierOther) + '"></label>' +
      '<label class="chk full"><input type="checkbox" id="f_viaSub"' + (d0.viaSub ? " checked" : "") + '>Sold through a sub-broker</label>' +
      '<label id="subWrap" class="full">Sub-broker<select id="f_sub">' + subOpts + '</select></label>' +
      '<p class="hint full" id="whishHint">Whish Money policies are not counted in sales or profit. They still get reminders.</p>' +
    '</div></fieldset>' +
    '<fieldset><legend>Client</legend><div class="grid">' +
      '<label>First name<input id="f_first" required value="' + esc(d0.firstName) + '" autocomplete="off"></label>' +
      '<label>Family name<input id="f_last" value="' + esc(d0.lastName) + '" autocomplete="off"></label>' +
      '<label class="full" id="phoneWrap"><span id="phoneLabel">Phone (WhatsApp)</span><span class="phonerow"><input id="f_phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="03 123 456" value="' + esc(d0.phone) + '">' +
        ('contacts' in navigator && 'select' in navigator.contacts ? '<button class="btn small" type="button" id="pickContact">Contacts</button>' : '') +
        (navigator.clipboard && navigator.clipboard.readText ? '<button class="btn small" type="button" id="pastePhone">Paste</button>' : '') + '</span></label>' +
    '</div></fieldset>' +
    '<fieldset><legend>Policy</legend><div class="grid">' +
      '<label class="full">Insurance<select id="f_line">' + lineSel + '</select></label>' +
      '<div class="grid full" id="optFields"></div>' +
      '<label>Policy number<input id="f_no" value="' + esc(d0.policyNo) + '" autocomplete="off"></label>' +
      '<label id="plateWrap">Car plate number<input id="f_plate" placeholder="e.g. B 123456" value="' + esc(d0.plate) + '" autocomplete="off"></label>' +
      '<label>Inception date<input id="f_inc" type="date" required value="' + esc(d0.inception) + '"></label>' +
      '<label>Expiry date<input id="f_exp" type="date" required value="' + esc(d0.expiry) + '"></label>' +
    '</div></fieldset>' +
    '<fieldset><legend>Money</legend><div class="grid">' +
      '<label>Price to client ($)<input id="f_price" type="number" min="0" step="0.01" inputmode="decimal" value="' + esc(d0.price) + '"></label>' +
      '<label>Cost ($)<input id="f_cost" type="number" min="0" step="0.01" inputmode="decimal" value="' + esc(d0.cost) + '"></label>' +
      '<label id="subCommWrap">Commission to sub-broker ($)<input id="f_subComm" type="number" min="0" step="0.01" inputmode="decimal" value="' + esc(d0.subComm) + '"></label>' +
      '<div class="calc full" id="calcBox"></div>' +
      '<p class="hint full" id="sugHint" hidden></p>' +
      (isEdit ? '' : '<label>Paid now ($)<input id="f_paid" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Empty if nothing paid yet"></label><label>Paid by<select id="f_method">' + METHODS.map(m => '<option>' + m + '</option>').join("") + '</select></label>') +
      '<label class="full">Notes<textarea id="f_notes" placeholder="Anything to remember about this client">' + esc(d0.notes) + '</textarea></label>' +
    '</div></fieldset>' +
    '<div class="actions"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="submit">' + (isEdit ? "Save changes" : "Save policy") + '</button></div></form></div></div>';
  bindModalClose();

  let details = Object.assign({}, d0.details || {});
  let priceTouched = isEdit || d0.price != null && d0.price !== "", expTouched = isEdit;
  const lineEl = $("#f_line"), inc = $("#f_inc"), exp = $("#f_exp");

  function drawOptions() {
    const L = lineOf(lineEl.value);
    $("#optFields").innerHTML = L.fields.map(f => fieldHTML(f, details)).join("");
    details = readDetails(L);
    $("#plateWrap").hidden = !L.motor;
    $("#optFields").querySelectorAll("select,input").forEach(el => el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", () => { details = readDetails(L); refresh(); }));
    refresh();
  }
  function refresh() {
    const L = lineOf(lineEl.value);
    for (const f of L.fields) { const w = $('#optFields [data-f="' + f.id + '"]'); if (w) w.hidden = !!(f.show && !f.show(details)); }
    const sup = $("#f_sup").value, via = $("#f_viaSub").checked;
    $("#supOtherWrap").hidden = sup !== "other";
    $("#whishHint").hidden = sup !== "whish";
    $("#subWrap").hidden = !via; $("#subCommWrap").hidden = !via;
    $("#phoneLabel").textContent = via ? "Client phone (optional, reminders go to the sub-broker)" : "Phone (WhatsApp)";
    // suggested price
    const sg = suggest(L.k, details), hint = $("#sugHint");
    if (sg && sup === "securite") {
      if (!priceTouched) { $("#f_price").value = sg.price; if (sg.comm != null) $("#f_cost").value = +(sg.price - sg.comm).toFixed(2); }
      hint.hidden = false; hint.textContent = "Portal price " + money(sg.price) + (sg.comm != null ? ", your commission " + money(sg.comm) : "") + ".";
    } else hint.hidden = true;
    // travel expiry
    if (L.k === "travel" && !expTouched && inc.value) { const n = TRAVEL_DAYS[details.duration || "Up to 7 days"]; if (n) exp.value = addDays(inc.value, n - 1); }
    else if (!expTouched && inc.value) exp.value = addYear(inc.value);
    // money box
    const price = num($("#f_price").value), cost = num($("#f_cost").value), sc = via ? num($("#f_subComm").value) : 0;
    const box = $("#calcBox");
    if (sup === "whish") box.innerHTML = '<span>Whish Money policy</span><b>Not counted in sales or profit</b>';
    else if (via) box.innerHTML = '<span>Total commission ' + money(price - cost) + ' · to sub-broker ' + money(sc) + '</span><b>I keep ' + money(price - cost - sc) + '</b>';
    else box.innerHTML = '<span>My profit on this policy</span><b>' + money(price - cost) + '</b>';
  }
  lineEl.addEventListener("change", () => { details = {}; priceTouched = false; drawOptions(); });
  ["#f_sup", "#f_viaSub"].forEach(s => $(s).addEventListener("change", refresh));
  $("#f_sub").addEventListener("change", e => {
    if (e.target.value !== "__new") return;
    e.target.value = "";
    const keep = snapshotForm();
    openSubForm(null, newId => { openForm(Object.assign(keep, { viaSub: true, subId: newId })); });
  });
  const cleanPhone = t => { const m = String(t || "").match(/\+?[\d][\d\s\-().]{5,}\d/); return m ? m[0].replace(/[\s\-().]/g, "") : ""; };
  if ($("#pickContact")) $("#pickContact").addEventListener("click", async () => {
    try {
      const [c] = await navigator.contacts.select(["name", "tel"], { multiple: false });
      if (!c) return;
      const tel = cleanPhone((c.tel || [])[0]); if (tel) $("#f_phone").value = tel; else toast("That contact has no phone number");
      const nm = String((c.name || [])[0] || "").trim().split(/\s+/);
      if (nm[0] && !$("#f_first").value.trim()) { $("#f_first").value = nm[0]; if (!$("#f_last").value.trim()) $("#f_last").value = nm.slice(1).join(" "); }
    } catch (e) { toast("Could not open contacts"); }
  });
  if ($("#pastePhone")) $("#pastePhone").addEventListener("click", async () => {
    try { const tel = cleanPhone(await navigator.clipboard.readText()); if (tel) $("#f_phone").value = tel; else toast("No phone number copied"); }
    catch (e) { toast("Allow paste, or long-press the box and choose Paste"); }
  });
  ["#f_price", "#f_cost"].forEach(s => $(s).addEventListener("input", () => { priceTouched = true; refresh(); }));
  $("#f_subComm").addEventListener("input", refresh);
  exp.addEventListener("input", () => expTouched = true);
  inc.addEventListener("change", refresh);

  function snapshotForm() {
    const L = lineOf(lineEl.value);
    return Object.assign({}, isEdit ? p : {}, {
      _renewFrom: d0._renewFrom, supplier: $("#f_sup").value, supplierOther: $("#f_supOther").value.trim(), viaSub: $("#f_viaSub").checked, subId: $("#f_sub").value,
      firstName: $("#f_first").value.trim(), lastName: $("#f_last").value.trim(), phone: $("#f_phone").value.trim(),
      line: L.k, details: readDetails(L), policyNo: $("#f_no").value.trim(), plate: L.motor ? $("#f_plate").value.trim().toUpperCase() : "",
      inception: inc.value, expiry: exp.value, price: num($("#f_price").value), cost: num($("#f_cost").value), subComm: $("#f_viaSub").checked ? num($("#f_subComm").value) : 0,
      notes: $("#f_notes").value.trim()
    });
  }

  $("#pf").addEventListener("submit", async e => {
    e.preventDefault();
    if (exp.value && inc.value && exp.value < inc.value) { toast("Expiry date must be after the inception date"); return; }
    if ($("#f_viaSub").checked && !$("#f_sub").value) { toast("Choose the sub-broker"); return; }
    const data = snapshotForm(); delete data._renewFrom; delete data.id;
    try {
      if (isEdit) {
        if (p.expiry !== data.expiry) data.reminders = {};
        await store.update("policies", p.id, data); toast("Changes saved"); drawDetail(p.id);
      } else {
        data.createdAt = Date.now(); data.reminders = {}; data.payments = [];
        const pn = num(($("#f_paid") || {}).value);
        if (pn > 0) data.payments = [{ id: "p" + Date.now(), amount: pn, date: todayStr(), method: $("#f_method").value }];
        if (d0._renewFrom) data.renewedFrom = d0._renewFrom;
        const newId = await store.add("policies", data);
        if (d0._renewFrom) { try { await store.update("policies", d0._renewFrom, { renewedTo: newId }); } catch (err) {} }
        closeModal(); toast(d0._renewFrom ? "Renewal saved" : "Policy saved");
      }
    } catch (err) { toast("Could not save. Check your connection and try again."); }
  });
  drawOptions();
  if (!isEdit && !d0.firstName) setTimeout(() => { const f = $("#f_first"); if (f) f.focus({ preventScroll: true }); }, 50);
}

function bindModalClose() {
  $("#modal").querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closeModal));
  const ov = $("#ov"); ov.addEventListener("click", e => { if (e.target === ov) closeModal(); });
}
function closeModal() { currentDetail = null; $("#modal").innerHTML = ""; }
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#ov")) closeModal(); });

/* ---------- export ---------- */
function exportCSV() {
  const cols = ["First name", "Family name", "Phone", "Insurance", "Options", "Policy number", "Car plate", "Supplier", "Sub-broker", "Inception", "Expiry", "Price", "Cost", "Sub-broker commission", "My profit", "Paid", "Remaining", "Notes"];
  const cell = v => { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const rows = policies.map(p => { const s = p.viaSub ? subOf(p.subId) : null, sup = SUPPLIERS.find(x => x.k === p.supplier);
    return [p.firstName, p.lastName, p.phone, lineOf(p.line).en, summary(p), p.policyNo, p.plate, p.supplier === "other" ? p.supplierOther : sup && sup.en, s && s.name, p.inception, p.expiry, p.price, p.cost, subComm(p), profit(p), paid(p), balance(p), p.notes].map(cell).join(","); });
  const blob = new Blob(["﻿" + cols.join(",") + "\n" + rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "BF_Policies_" + todayStr() + ".csv"; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- login ---------- */
function loginView(err) {
  $("#modal").innerHTML = "";
  $("#app").innerHTML = '<div class="wrap"><div class="login"><img src="icon-192.png" alt="BF Insurance"><div><h2>BF Policy Desk</h2><p class="sub">Sign in to see your policies.</p></div>' +
    '<form id="lf"><label>Email<input id="l_email" type="email" autocomplete="username" required></label><label>Password<input id="l_pass" type="password" autocomplete="current-password" required></label>' +
    '<p class="err" id="l_err">' + esc(err || "") + '</p><button class="btn primary" type="submit">Sign in</button><button class="btn ghost small" type="button" id="l_reset">Forgot password?</button></form></div></div>';
  $("#lf").addEventListener("submit", async e => {
    e.preventDefault(); $("#l_err").textContent = "";
    try { await store.signIn($("#l_email").value.trim(), $("#l_pass").value); }
    catch (x) { $("#l_err").textContent = "Wrong email or password. Try again."; }
  });
  $("#l_reset").addEventListener("click", async () => {
    const em = $("#l_email").value.trim(); if (!em) { $("#l_err").textContent = "Type your email first, then tap Forgot password."; return; }
    try { await store.resetPassword(em); $("#l_err").textContent = "We emailed you a link to set a new password."; } catch (x) { $("#l_err").textContent = "Could not send the email. Check the address."; }
  });
}

/* ---------- start ---------- */
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (["overview", "reminders", "policies", "clients", "subbrokers"].includes(h) && h !== tab) { tab = h; render(); } });
store.init(u => {
  user = u;
  if (!u) { loginView(); return; }
  shell(); render();
  const timer = setTimeout(() => { if (!loaded.policies) { loadError = "Your data is taking long to load. Check your internet connection."; render(); } }, 10000);
  const onErr = err => { clearTimeout(timer); loadError = err && err.code === "permission-denied" ? "This account is not allowed to see the data. Ask Claude to add it." : "Could not load your data. Reopen the app to try again."; loaded.policies = false; render(); };
  store.watch("subbrokers", rows => { subs = rows; loaded.subbrokers = true; render(); if (currentDetail) drawDetail(currentDetail); }, onErr);
  store.watch("policies", rows => { clearTimeout(timer); policies = rows; loaded.policies = true; loadError = ""; render(); if (currentDetail) drawDetail(currentDetail); }, onErr);
}).catch(() => { $("#app").innerHTML = '<p class="wrap" style="padding-top:40px">Could not start. Check your internet connection and reload.</p>'; });
