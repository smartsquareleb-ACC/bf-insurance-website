/**
 * BF Policy Desk — daily renewal alert.
 * Runs in Google Apps Script on the Google account that owns the Firebase project (bf-policy-desk).
 * Every morning it lists the renewals still open (from 30 days before expiry until the policy is
 * renewed or marked "Not renewing"; travel excluded), then:
 *   - sends a push to the ntfy app (count only, no client names), if NTFY_TOPIC is set;
 *   - emails the full list to ALERT_EMAIL (default: this Google account), if SEND_EMAIL is not "no".
 * Settings live in Project Settings > Script properties: NTFY_TOPIC, ALERT_EMAIL, SEND_EMAIL.
 * Run setup() once to create the 8 AM daily trigger.
 */
var PROJECT = "bf-policy-desk";
var APP = "https://bfinsurancelb.com/system/#reminders";
var TZ = "Asia/Beirut";

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "dailyAlert") ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("dailyAlert").timeBased().everyDays(1).atHour(8).inTimezone(TZ).create();
  dailyAlert();
}

function val(f) {
  if (!f) return null;
  if ("stringValue" in f) return f.stringValue;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("doubleValue" in f) return f.doubleValue;
  if ("booleanValue" in f) return f.booleanValue;
  if ("nullValue" in f) return null;
  if ("timestampValue" in f) return f.timestampValue;
  if ("mapValue" in f) { var o = {}, m = f.mapValue.fields || {}; for (var k in m) o[k] = val(m[k]); return o; }
  if ("arrayValue" in f) return (f.arrayValue.values || []).map(val);
  return null;
}

function loadPolicies() {
  var out = [], token = ScriptApp.getOAuthToken(), page = "";
  do {
    var url = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents/policies?pageSize=300" + (page ? "&pageToken=" + page : "");
    var r = JSON.parse(UrlFetchApp.fetch(url, { headers: { Authorization: "Bearer " + token } }).getContentText());
    (r.documents || []).forEach(function (d) { var o = {}, f = d.fields || {}; for (var k in f) o[k] = val(f[k]); out.push(o); });
    page = r.nextPageToken || "";
  } while (page);
  return out;
}

function daysUntil(iso) {
  var today = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd");
  return Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000);
}

var LINES = { motor_tpl: "Elzeme / Dod l gheir", motor_allrisk: "Car all risk", motor_tl: "Total loss", travel: "Travel", medical: "Medical", medical_sme: "Staff medical (company)", worker: "Domestic worker", accident: "Personal accident", home: "Home (LM7 residence)", fire_common: "Building common parts", lm7: "Shop / office (LM7 commercial)", jewelry: "Jewellery shop", fire_allied: "Fire & allied perils", workmen: "Workmen compensation", construction: "Construction site", public_liab: "Public liability", signboard: "Signboard / elevator / drone", malpractice: "Medical malpractice", other: "Other" };

function dailyAlert() {
  var props = PropertiesService.getScriptProperties();
  var open = loadPolicies().filter(function (p) {
    return p.line !== "travel" && !p.renewedTo && !p.closed && p.expiry && daysUntil(p.expiry) <= 30;
  }).map(function (p) { p.n = daysUntil(p.expiry); return p; }).sort(function (a, b) { return a.n - b.n; });
  if (!open.length) return;

  var expired = open.filter(function (p) { return p.n < 0; }).length;
  var soon = open.filter(function (p) { return p.n >= 0 && p.n <= 7; }).length;
  var title = open.length + (open.length === 1 ? " renewal" : " renewals") + " to follow up";
  var body = [expired ? expired + " expired" : "", soon ? soon + " expire within 7 days" : "", "Tap to open Reminders"].filter(String).join(" · ");

  var topic = props.getProperty("NTFY_TOPIC");
  if (topic) {
    UrlFetchApp.fetch("https://ntfy.sh/" + encodeURIComponent(topic), {
      method: "post", payload: body, muteHttpExceptions: true,
      headers: { Title: "BF Desk: " + title, Click: APP, Priority: expired || soon ? "high" : "default", Tags: "bell" }
    });
  }

  if (props.getProperty("SEND_EMAIL") !== "no") {
    var to = props.getProperty("ALERT_EMAIL") || Session.getEffectiveUser().getEmail();
    var rows = open.map(function (p) {
      var name = [p.firstName, p.lastName].filter(String).join(" ") || "Unnamed client";
      var when = p.n < 0 ? "expired " + (-p.n) + " days ago" : p.n === 0 ? "expires today" : "expires in " + p.n + " days";
      var r = p.reminders || {};
      var sent = r.d15 ? "15-day reminder sent" : r.d30 ? "30-day reminder sent" : "no reminder sent yet";
      return "<tr><td style='padding:6px 10px'><b>" + name + "</b></td><td style='padding:6px 10px'>" + (LINES[p.line] || p.line || "") + (p.plate ? " · " + p.plate : "") +
        "</td><td style='padding:6px 10px;color:" + (p.n < 0 ? "#b42318" : p.n <= 7 ? "#b54708" : "#344054") + "'>" + when + "</td><td style='padding:6px 10px;color:#667085'>" + sent + "</td></tr>";
    }).join("");
    MailApp.sendEmail({
      to: to, subject: "BF Desk: " + title,
      htmlBody: "<div style='font-family:Arial,sans-serif;color:#101828'><p>These policies are not renewed yet. They stay on this list every day until you renew them or mark them <b>Not renewing</b> in the app.</p>" +
        "<table style='border-collapse:collapse;font-size:14px'>" + rows + "</table><p><a href='" + APP + "' style='color:#1A3AA6'>Open Reminders in BF Desk</a></p></div>"
    });
  }
}
