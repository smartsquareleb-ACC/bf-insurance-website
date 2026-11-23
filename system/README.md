# BF Policy Desk

Private policy system for BF Insurance, served at https://bfinsurancelb.com/system/ (Netlify deploys `main`).

- `index.html` page and styles, `app.js` screens, `catalog.js` every insurance line and portal option, `store.js` data layer, `config.js` Firebase settings.
- While `config.js` has `FIREBASE_CONFIG = null` the app runs in test mode and keeps data on the device only.
- Data: Firestore collections `policies` and `subbrokers`, protected by `firestore.rules` (paste into Firebase console > Firestore > Rules). Access: Firebase Authentication (email + password) and a `/members/<uid>` document per allowed account.
- Install on a phone: open the link, then Share > Add to Home Screen (iPhone) or menu > Install app (Android).
- Daily renewal alert: `alerts/daily-alert.gs` runs in Google Apps Script on the account that owns the Firebase project, every day at 8 AM Beirut. It lists renewals still open (30 days before expiry until renewed or marked "Not renewing", travel excluded), pushes a count to the ntfy app (script property `NTFY_TOPIC`) and emails the full list (`ALERT_EMAIL`, `SEND_EMAIL`).
