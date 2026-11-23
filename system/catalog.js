// BF Policy Desk: every insurance line and the options the Sécurité portal offers.
// Add or rename options here; the forms, lists and messages read from this file.

const YESNO = "check";

export const LINES = [
  { k: "motor_tpl", group: "Motor", en: "Elzeme / Dod l gheir", ar: "تأمين إلزامي وضد الغير", motor: true, fields: [
    { id: "vehicle", label: "Vehicle", opts: ["Private car", "Motorcycle under 125cc", "Motorcycle 125cc and above", "Commercial vehicle", "Van / Pick-up", "Truck", "Other vehicle"] },
    { id: "cover", label: "Cover", opts: ["Elzeme + Dod l gheir", "Elzeme only", "Dod l gheir only"] },
    { id: "md", label: "Dod l gheir option", opts: ["Small ($55, with Elzeme $100)", "Medium ($65, with Elzeme $110)", "Big ($75, with Elzeme $120)"],
      show: d => d.cover !== "Elzeme only" && (d.vehicle || "Private car") === "Private car" }
  ]},
  { k: "motor_allrisk", group: "Motor", en: "Car all risk", ar: "تأمين السيارة شامل", motor: true, fields: [
    { id: "program", label: "Program", opts: ["Optimal", "Optimal with deductible", "Infinite", "Electric & Hybrid", "Dealer repair", "50/50 All Risks", "Collision"] },
    { id: "year", label: "Car year", type: "number" },
    { id: "value", label: "Car value ($)", type: "number" },
    { id: "elzeme", label: "Elzeme included", type: YESNO },
    { id: "pv", label: "Political violence", type: YESNO },
    { id: "sport", label: "Special, sport or luxury car", type: YESNO },
    { id: "chinese", label: "Chinese car", type: YESNO }
  ]},
  { k: "motor_tl", group: "Motor", en: "Total loss", ar: "تأمين الخسارة الكلية", motor: true, fields: [
    { id: "vehicle", label: "Vehicle", opts: ["Private car", "Van / Pick-up", "Truck"] },
    { id: "year", label: "Car year", type: "number" },
    { id: "value", label: "Car value ($)", type: "number" }
  ]},
  { k: "travel", group: "People", en: "Travel", ar: "تأمين السفر", fields: [
    { id: "plan", label: "Plan", opts: ["Silver", "Silver Plus", "Platinum"] },
    { id: "duration", label: "Duration", opts: ["Up to 7 days", "Up to 15 days", "Up to 32 days", "Up to 62 days", "Up to 92 days", "6 months (consecutive stay)", "1 year (consecutive stay)"] },
    { id: "travellers", label: "Travellers", type: "number" },
    { id: "destination", label: "Destination", type: "text" },
    { id: "sports", label: "Winter / summer sports", type: YESNO },
    { id: "nodeduct", label: "Remove deductible", type: YESNO }
  ]},
  { k: "medical", group: "People", en: "Medical", ar: "التأمين الصحي", fields: [
    { id: "plan", label: "Plan", opts: ["Essential Care", "Advanced Care", "Ultimate Care", "Conversion option (guaranteed renewability)"] },
    { id: "class", label: "Class", opts: ["First class (A, private room)", "Second class (B, shared room)", "Third class (K, ward)"], show: d => d.plan !== "Essential Care" },
    { id: "amb", label: "Outpatient (ambulatory)", opts: ["No outpatient", "Outpatient 85%", "Outpatient 100%"] },
    { id: "prev", label: "Preventive Care add-on", type: YESNO },
    { id: "members", label: "Members (people on the policy)", type: "number" }
  ]},
  { k: "medical_sme", group: "People", en: "Staff medical (company)", ar: "التأمين الصحي للموظفين", fields: [
    { id: "plan", label: "Plan", opts: ["Essential Care", "Advanced Care", "Ultimate Care"] },
    { id: "class", label: "Class", opts: ["First class (A)", "Second class (B)", "Third class (K)"] },
    { id: "employees", label: "Employees", type: "number" }
  ]},
  { k: "worker", group: "People", en: "Domestic worker", ar: "تأمين العاملة المنزلية", fields: [
    { id: "gender", label: "Worker", opts: ["Female", "Male"] },
    { id: "plan", label: "Plan", opts: ["In hospital", "In hospital + telemedicine", "In hospital + telemedicine + outpatient", "Premium"] },
    { id: "workerName", label: "Worker's name", type: "text" }
  ]},
  { k: "accident", group: "People", en: "Personal accident", ar: "تأمين الحوادث الشخصية", fields: [
    { id: "class", label: "Job class", opts: ["Class A", "Class B", "Class C", "Class D"] },
    { id: "si", label: "Sum insured ($)", type: "number" }
  ]},
  { k: "home", group: "Property", en: "Home (LM7 residence)", ar: "تأمين المنزل", fields: [
    { id: "own", label: "Owner or tenant", opts: ["Owner", "Tenant"] },
    { id: "area", label: "Area (m²)", type: "number" },
    { id: "contents", label: "Contents value ($)", type: "number" },
    { id: "solar", label: "Solar panels", type: YESNO },
    { id: "gen", label: "Generator", type: YESNO },
    { id: "workers", label: "2 domestic workers (accidents)", type: YESNO }
  ]},
  { k: "fire_common", group: "Property", en: "Building common parts", ar: "تأمين الأقسام المشتركة للبناية", fields: [
    { id: "building", label: "Building value ($)", type: "number" },
    { id: "wc", label: "Workmen compensation", type: YESNO },
    { id: "tpl", label: "Third-party liability", type: YESNO }
  ]},
  { k: "lm7", group: "Business", en: "Shop / office (LM7 commercial)", ar: "تأمين المحل أو المكتب", fields: [
    { id: "class", label: "Class", opts: ["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2", "E"] },
    { id: "own", label: "Owner or tenant", opts: ["Owner", "Tenant"] },
    { id: "activity", label: "Activity", type: "text" }
  ]},
  { k: "jewelry", group: "Business", en: "Jewellery shop", ar: "تأمين محل مجوهرات", fields: [
    { id: "own", label: "Owner or tenant", opts: ["Owner", "Tenant"] },
    { id: "stock", label: "Jewellery stock ($)", type: "number" }
  ]},
  { k: "fire_allied", group: "Business", en: "Fire & allied perils", ar: "تأمين الحريق والأخطار الملحقة", fields: [
    { id: "class", label: "Class", opts: ["A0", "A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2", "E"] },
    { id: "own", label: "Owner or tenant", opts: ["Owner", "Tenant"] },
    { id: "activity", label: "Activity", type: "text" }
  ]},
  { k: "workmen", group: "Business", en: "Workmen compensation", ar: "تأمين تعويض العمال", fields: [
    { id: "class", label: "Class", opts: ["A", "B", "C", "D", "E"] },
    { id: "workers", label: "Workers", type: "number" },
    { id: "salaries", label: "Yearly salaries ($)", type: "number" },
    { id: "delivery", label: "Delivery men", type: "number" },
    { id: "hernia", label: "Hernia / lumbago", type: YESNO },
    { id: "el", label: "Employers liability", type: YESNO }
  ]},
  { k: "construction", group: "Business", en: "Construction site", ar: "تأمين ورشة بناء", fields: [
    { id: "type", label: "Work", opts: ["Construction", "Renovation (internal)", "Renovation (internal / external, scaffolding)"] },
    { id: "period", label: "Period", opts: ["1 month", "3 months", "6 months", "12 months"] },
    { id: "pl", label: "Public liability", opts: ["None", "Option I (5k / 5k / 25k)", "Option II (10k / 10k / 50k)"] },
    { id: "area", label: "Area (m²)", type: "number" },
    { id: "crane", label: "Crane extension", type: YESNO }
  ]},
  { k: "public_liab", group: "Business", en: "Public liability", ar: "تأمين المسؤولية المدنية", fields: [
    { id: "type", label: "Type", opts: ["Commercial", "Industrial", "Hotel / restaurant / resort", "Gym / health center", "Petrol station", "Garage", "Common parts"] },
    { id: "limit", label: "Limit ($1,000 per claim / yearly)", opts: ["2.5 / 10", "5 / 25", "10 / 50", "25 / 100"] },
    { id: "elev", label: "Elevators", type: "number" },
    { id: "valet", label: "Valet parking", type: YESNO },
    { id: "sign", label: "Signboard", type: YESNO },
    { id: "food", label: "Food poisoning", type: YESNO },
    { id: "pool", label: "Swimming pool", type: YESNO },
    { id: "fire", label: "Fire & explosion", type: YESNO },
    { id: "trial", label: "Trial test", type: YESNO }
  ]},
  { k: "signboard", group: "Business", en: "Signboard / elevator / drone", ar: "تأمين يافطة أو مصعد أو درون", fields: [
    { id: "type", label: "Type", opts: ["Signboard", "Elevator, residential up to 9 floors", "Elevator, residential 10+ floors", "Elevator, commercial center", "Industrial monte-charge", "Drone"] },
    { id: "limit", label: "Limit", opts: ["$5,000", "$10,000", "$25,000", "$50,000"] }
  ]},
  { k: "malpractice", group: "Business", en: "Medical malpractice", ar: "تأمين الأخطاء الطبية", fields: [
    { id: "prof", label: "Profession", opts: ["Doctor", "Surgeon / anaesthetist", "Practical nurse", "Nurse (not in OR)", "Nurse (in OR)"] },
    { id: "limit", label: "Limit", type: "text" }
  ]},
  { k: "other", group: "Other", en: "Other", ar: "التأمين", fields: [
    { id: "what", label: "What insurance", type: "text" }
  ]}
];

export const lineOf = k => LINES.find(l => l.k === k) || LINES[LINES.length - 1];

export const SUPPLIERS = [
  { k: "securite", en: "Sécurité Assurance" },
  { k: "whish", en: "Whish Money" },
  { k: "other", en: "Other" }
];

// Duration -> days, for travel expiry.
export const TRAVEL_DAYS = { "Up to 7 days": 7, "Up to 15 days": 15, "Up to 32 days": 32, "Up to 62 days": 62, "Up to 92 days": 92, "6 months (consecutive stay)": 184, "1 year (consecutive stay)": 365 };

// Suggested price and BF commission (Sécurité portal, motor TPL from 24/11/2026).
// Returns null when there is no fixed price.
export function suggest(line, d) {
  if (line === "motor_tpl") {
    const v = d.vehicle || "Private car", c = d.cover || "Elzeme + Dod l gheir";
    if (v === "Private car") {
      const i = Math.max(0, ["Small", "Medium", "Big"].findIndex(x => (d.md || "Small").startsWith(x)));
      if (c === "Elzeme only") return { price: 45, comm: 13.5 };
      if (c === "Dod l gheir only") { const p = [55, 65, 75][i]; return { price: p, comm: p * 0.3 }; }
      return { price: [100, 110, 120][i], comm: [30, 35, 40][i] };
    }
    if (v.startsWith("Motorcycle")) {
      const big = v.includes("and above"), t = big ? { bi: 35, md: 30, both: 65 } : { bi: 25, md: 25, both: 50 };
      return { price: c === "Elzeme only" ? t.bi : c === "Dod l gheir only" ? t.md : t.both, comm: null };
    }
  }
  if (line === "worker") {
    const i = Math.max(0, ["In hospital", "In hospital + telemedicine", "In hospital + telemedicine + outpatient", "Premium"].indexOf(d.plan || "In hospital"));
    return { price: (d.gender === "Male" ? [85, 93, 120, 180] : [65, 70, 100, 150])[i], comm: null };
  }
  return null;
}

// Short summary of the chosen options, for lists and messages.
export function summary(p) {
  const L = lineOf(p.line), d = p.details || {};
  const bits = [];
  for (const f of L.fields) {
    if (f.show && !f.show(d)) continue;
    const v = d[f.id];
    if (v === undefined || v === "" || v === false || v === null) continue;
    if (f.type === "check") bits.push(f.label);
    else if (f.type === "number") bits.push(f.label.replace(/ \(.*\)$/, "") + " " + Number(v).toLocaleString("en-US"));
    else bits.push(v);
  }
  return bits.join(" · ");
}
